import React, { useState, useEffect, type FormEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import { useSession, signOut, type Session } from './lib/auth-client';
import { LogOut, Image, Paperclip, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Attachment } from './lib/db';
import { syncQueue, pullFromServer } from './lib/sync';
import { v4 as uuidv4 } from 'uuid';
import { useRef, type ChangeEvent } from 'react';

import { trpcClient, queryClient, trpc } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import { ContextSuggestions } from './components/ContextSuggestions';
import TimelinePage from './components/TimelinePage';

function ProtectedLayout() {
  const { data: session, isPending, error } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Offline Auth: Fallback to cached session
  const [cachedSession, setCachedSession] = useState<Session | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('din-session');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem('din-session', JSON.stringify(session));
    }
  }, [session]);

  useEffect(() => {
    // Initial sync on load if online
    syncQueue();
    pullFromServer();
  }, []);

  // Use cached session if real session fails (offline) or is pending but we have cache
  const effectiveSession = session || (error ? cachedSession : null) || (isPending ? cachedSession : null);

  if (isPending && !cachedSession) {
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }

  if (!effectiveSession?.user) {
    // Only redirect if we definitely have no session and no cache
    if (!isPending) return <Navigate to="/login" replace />;
    // If pending and no cache, wait (loading state above covers this)
    return null;
  }

  const user = effectiveSession.user;

  return (
    <div className="min-h-full min-w-screen bg-gray-50 flex flex-col items-center select-none">
      {/* @ts-ignore - isAnonymous is added by plugin */}
      {user.isAnonymous && (
        <div className="w-full bg-amber-50 px-4 py-3 text-sm text-amber-800 text-center border-b border-amber-100 flex items-center justify-center gap-2 relative z-50">
          <span>You are using a temporary guest account.</span>
          <button
            onClick={() => navigate('/login')}
            className="underline font-medium hover:text-amber-900"
          >
            Sign in to save data
          </button>
        </div>
      )}
      {isHome && (
        <>
          <header className="  absolute top-4 right-4 z-10 animate-fade-in">
            <div className="relative group">
              <button className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
                {user.image ? (
                  <img src={user.image} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-300" />
                )}
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 hidden group-hover:block px-1 py-1">
                <button onClick={() => signOut()} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2">
                  <LogOut className="w-3 h-3" /> Logout
                </button>
              </div>
            </div>
          </header>
          <div className="absolute top-4 left-4 z-10 animate-fade-in">
            <button
              onClick={() => navigate('/timeline')}
              className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 transition-colors flex items-center gap-1"
              title="Timeline"
            >
              <Clock className="w-5 h-5" />
              {/* Optional label if we want explicit, but icon is subtle/nice */}
            </button>
          </div>
        </>
      )}
      <main className="w-full max-w-lg flex-1 flex flex-col relative px-4 md:px-0">
        <Outlet />
      </main>
    </div>
  );
}

function DinApp() {
  // Drafts: Load from localStorage
  const [text, setText] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('din-draft') || '';
    }
    return '';
  });

  // Drafts: Autosave
  useEffect(() => {
    localStorage.setItem('din-draft', text);
  }, [text]);

  const [layoutState, setLayoutState] = useState<'IDLE' | 'CAPTURED' | 'DONE'>('IDLE');
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Rotate placeholders
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [placeholder, setPlaceholder] = useState("What happened?");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'file') => {
    if (e.target.files && e.target.files.length > 0) {
      const newAtts: Attachment[] = Array.from(e.target.files).map(f => ({
        id: uuidv4(),
        type: f.type.startsWith('image/') ? 'image' : 'file', // refined type
        mimeType: f.type,
        name: f.name,
        blob: f,
        synced: 0
      }));
      setAttachments(prev => [...prev, ...newAtts]);
      // Reset input so same file can be selected again if needed
      if (e.target) e.target.value = '';
    }
  };

  // Local entries for debugging/verification only (not essential for the input-only UI)
  // const entries = useLiveQuery(() => db.entries.reverse().sortBy('created_at'));

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && attachments.length === 0) return;

    const entryId = uuidv4();
    const now = Date.now();

    try {
      // 1. Local Write
      await db.entries.add({
        id: entryId,
        created_at: now,
        text: text.trim(),
        attachments: attachments,
        synced: 0
      });

      // 2. Clear UI & Draft immediately
      setText('');
      setAttachments([]);
      localStorage.removeItem('din-draft');
      setCurrentEntryId(entryId);
      setLayoutState('CAPTURED');

      // 3. Trigger Sync (fire and forget)
      syncQueue();

      // 4. Do NOT auto-reset. Wait for Context completion or explicit dismissal.

    } catch (error) {
      console.error("Capture failed locally", error);
      alert("Something went wrong saving to your device.");
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between py-6 min-h-[80vh]">
      {/* Input Surface */}
      <div className="flex-1 flex flex-col pt-12">
        {layoutState === 'CAPTURED' ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in w-full max-w-md mx-auto">
            <p className="text-xl text-zinc-800 font-medium mb-2">Captured.</p>
            {currentEntryId && (
              <ContextSuggestions
                entryId={currentEntryId}
                onComplete={() => {
                  // Show "Got it" then reset
                  setLayoutState('DONE');
                  setTimeout(() => {
                    setLayoutState('IDLE');
                    setCurrentEntryId(null);
                  }, 1500);
                }}
              />
            )}
          </div>
        ) : layoutState === 'DONE' ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
            <p className="text-xl text-zinc-500 font-medium">Got it.</p>
          </div>
        ) : (
          <>
            <div className="w-full" data-color-mode="light">
              <style>{`
                /* Functional requirement: Hide toolbar on mobile */
                @media (max-width: 768px) {
                  .w-md-editor-toolbar {
                    display: none;
                  }
                }
                /* Fix broken text selection (white on white) */
                .w-md-editor ::selection,
                .w-md-editor-text ::selection,
                .w-md-editor-text-input ::selection,
                .w-md-editor-text-pre ::selection {
                  background-color: #bfdbfe !important; /* blue-200 */
                  color: #1f2937 !important; /* gray-800 */
                  -webkit-text-fill-color: #1f2937 !important;
                }
              `}</style>
              <MDEditor
                value={text}
                onChange={(val?: string) => setText(val || '')}
                preview="edit"
                visibleDragbar={false}
                height="50vh"
                style={{
                  backgroundColor: 'transparent',
                  fontSize: '18px', // Increased a bit from default
                  boxShadow: 'none',
                }}
                className="w-full"
                textareaProps={{
                  placeholder: placeholder,
                  autoFocus: true,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }
                }}
              />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-3 overflow-x-auto p-2 pb-4">
                {attachments.map((att) => (
                  <div key={att.id} className="relative group shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-zinc-200 bg-gray-50 flex items-center justify-center">
                    {att.type === 'image' && att.blob ? (
                      <img src={URL.createObjectURL(att.blob)} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs text-center p-1 text-zinc-500 break-all">{att.name || att.type}</div>
                    )}
                    <button
                      onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attachment Row */}
            <div className="flex items-center gap-4 px-2 mt-4">
              <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />

              <button onClick={() => imageInputRef.current?.click()} className="p-3 rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 transition-colors">
                <Image className="w-5 h-5" />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Primary Action */}
      <div className="pb-6">
        <button
          onClick={() => handleSubmit()}
          disabled={layoutState === 'CAPTURED' || (!text.trim() && attachments.length === 0)}
          className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] text-white rounded-2xl text-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {layoutState === 'CAPTURED' ? 'Saved' : 'Capture'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DinApp />} />
              <Route path="/timeline" element={<TimelinePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
