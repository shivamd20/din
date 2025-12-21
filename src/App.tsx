import React, { useState, useEffect, type FormEvent, useRef, type ChangeEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSession, signIn, type Session } from './lib/auth-client';
import { Image, Paperclip } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Attachment } from './lib/db';
import { syncQueue, pullFromServer } from './lib/sync';
import { v4 as uuidv4 } from 'uuid';
import { trpcClient, queryClient, trpc } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import { ContextSuggestions } from './components/ContextSuggestions';
import TimelinePage from './components/TimelinePage';
import { Header } from './components/layout/Header';
import { GuestBanner } from './components/layout/GuestBanner';
import { ReplyContextRef } from './components/ReplyContextRef';
import { getMicrocopy } from './lib/microcopy';

function ProtectedLayout() {
  const { data: session, isPending, error } = useSession();

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

  const [isSigningIn, setIsSigningIn] = useState(false);

  // Implicit Anonymous Login
  useEffect(() => {
    if (!isPending && !effectiveSession?.user && !isSigningIn) {
      setIsSigningIn(true); // Prevent double-firing
      signIn.anonymous()
        .then((res) => {
          // Optional: force re-fetch if better-auth doesn't auto-update
          // session.update() 
        })
        .catch((e) => {
          console.error("Anonymous login failed", e);
        })
        .finally(() => {
          setIsSigningIn(false);
        });
    }
  }, [isPending, effectiveSession?.user, isSigningIn]);

  if (isPending && !cachedSession) {
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }

  // If we are still waiting for implicit login to complete
  if (!effectiveSession?.user) {
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-gray-500">Initializing...</div>;
  }

  const user = effectiveSession.user;

  return (
    <div className="h-[100dvh] w-full bg-[#f9fafb] flex flex-col overflow-hidden relative">
      <Header user={user} />

      {/* Main Content Area - Scrollable if internal parts sync, but we want flex-1 layout */}
      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col relative z-0 overflow-hidden">
        <Outlet />
      </main>

      {/* Guest Banner */}
      {/* @ts-ignore */}
      <GuestBanner isAnonymous={user.isAnonymous} />
    </div>
  );
}

function DinApp() {
  // ... state declarations
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
  const [currentSuggestions, setCurrentSuggestions] = useState<{ chipId: string; chipLabel: string; generationId: string }[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<string | undefined>(undefined);
  const [confirmationMsg, setConfirmationMsg] = useState("Captured.");
  const [isThinking, setIsThinking] = useState(false);

  // Reset state when entry changes
  useEffect(() => {
    setCurrentSuggestions([]);
    setCurrentAnalysis(undefined);
  }, [currentEntryId]);

  // Reply State
  const [replyContext, setReplyContext] = useState<{ id: string, text: string } | null>(null);

  // Watch for suggestions
  const activeEntry = useLiveQuery(
    async () => {
      if (!currentEntryId) return null;
      return db.entries.get(currentEntryId);
    },
    [currentEntryId]
  );

  useEffect(() => {
    if (activeEntry?.transientSuggestions) {
      setCurrentSuggestions(activeEntry.transientSuggestions);
    }
    if (activeEntry?.transientAnalysis) {
      setCurrentAnalysis(activeEntry.transientAnalysis);
    }
  }, [activeEntry]);

  // Rotate placeholders
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [placeholder, setPlaceholder] = useState("What happened?");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'file') => {
    // ... same as before
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
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && attachments.length === 0) return;

    const entryId = uuidv4();
    const now = Date.now();
    const isReply = !!replyContext;

    try {
      // 1. Local Write
      await db.entries.add({
        id: entryId,
        created_at: now,
        text: text.trim(),
        attachments: attachments,
        synced: 0,
        rootId: isReply ? replyContext.id : entryId,
        parentId: isReply ? replyContext.id : undefined,
      });

      // 2. Clear UI & Draft
      setText('');
      setAttachments([]);
      localStorage.removeItem('din-draft');

      // 3. UI Transition
      // If we were replying, we usually done (Depth 2 limit), or could show more chips?
      // Spec says "Max 2 follow ups per entry".
      // If we just saved a reply, we show "Got it" and reset.
      // If we saved a root, we show "Captured" and maybe ContextSuggestions.

      if (isReply) {
        setLayoutState('DONE');
        setConfirmationMsg(getMicrocopy('CLOSURE'));
        setReplyContext(null); // Clear reply context
        setTimeout(() => {
          setLayoutState('IDLE');
          setCurrentEntryId(null);
        }, 1500);
      } else {
        setCurrentEntryId(entryId);
        setLayoutState('CAPTURED');
        setConfirmationMsg(getMicrocopy('CONFIRMATION'));

        // Trigger Sync immediately to get AI suggestions
        setIsThinking(true);
        try {
          await syncQueue();
        } finally {
          setIsThinking(false);
        }
      }

    } catch (error) {
      console.error("Capture failed locally", error);
      alert("Something went wrong saving to your device.");
    }
  };

  /* Scroll helper */
  const scrollToActive = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // optional: exact scroll logic
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const onReply = (chip: { label: string, id: string, generationId: string }) => {
    // User clicked a suggestion
    if (!currentEntryId) return;

    // We need the text of the entry we are replying to.
    db.entries.get(currentEntryId).then(entry => {
      if (entry) {
        setReplyContext({ id: entry.id, text: entry.text });
        setLayoutState('IDLE');
        setPlaceholder(chip.label); // Use chip label as prompt
        // We could store the provenance (chip.id, generationId) to save with the reply?
        // App.tsx doesn't have state for that yet, but we can verify later.
      }
    });
  };

  return (
    <div className="h-full flex flex-col relative w-full">
      <div className="flex-1 flex flex-col min-h-0 relative">
        {layoutState === 'CAPTURED' ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in w-full max-w-md mx-auto">
            <p className="text-xl text-zinc-800 font-medium mb-2">{confirmationMsg}</p>
            {currentEntryId && (
              <ContextSuggestions
                suggestions={currentSuggestions}
                analysis={currentAnalysis}
                loading={isThinking}
                onReply={onReply}
                onComplete={() => {
                  setLayoutState('DONE');
                  setConfirmationMsg(getMicrocopy('CLOSURE'));
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
            <p className="text-xl text-zinc-500 font-medium">{confirmationMsg}</p>
          </div>
        ) : (
          <>
            {replyContext && (
              <ReplyContextRef
                text={replyContext.text}
                onDismiss={() => {
                  setReplyContext(null);
                  setPlaceholder("What happened?");
                }}
              />
            )}
            <div className="flex-1 w-full flex flex-col" data-color-mode="light">
              <style>{`
                /* Hide toolbar on mobile */
                @media (max-width: 768px) {
                  .w-md-editor-toolbar {
                    display: none;
                  }
                }
                .w-md-editor {
                    background-color: transparent !important;
                    box-shadow: none !important;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .w-md-editor-content {
                    flex: 1;
                }
                /* Fix broken text selection */
                .w-md-editor ::selection,
                .w-md-editor-text ::selection,
                .w-md-editor-text-input ::selection,
                .w-md-editor-text-pre ::selection {
                  background-color: #bfdbfe !important; 
                  color: #1f2937 !important;
                  -webkit-text-fill-color: #1f2937 !important;
                }
              `}</style>
              <MDEditor
                value={text}
                onChange={(val?: string) => setText(val || '')}
                preview="edit"
                visibleDragbar={false}
                height="100%"
                style={{
                  backgroundColor: 'transparent',
                  fontSize: '18px',
                  boxShadow: 'none',
                  flex: 1, // Ensure it fills
                }}
                className="w-full flex-1"
                textareaProps={{
                  placeholder: placeholder,
                  autoFocus: true,
                  onFocus: scrollToActive,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }
                }}
              />
            </div>

            {/* Attachments Preview - Just above toolbar */}
            {attachments.length > 0 && (
              <div className="flex gap-3 overflow-x-auto p-2 pb-0 flex-none bg-[#f9fafb]/90 backdrop-blur-sm z-20">
                {attachments.map((att) => (
                  <div key={att.id} className="relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-zinc-200 bg-gray-50 flex items-center justify-center">
                    {att.type === 'image' && att.blob ? (
                      <img src={URL.createObjectURL(att.blob)} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs text-center p-1 text-zinc-500 break-all">{att.name || att.type}</div>
                    )}
                    <button
                      onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 border border-white/20"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Primary Action Bar - Sticky Bottom Area */}
      {layoutState === 'IDLE' && (
        <div className="flex-none pb-4 pt-2 px-1 flex items-center gap-3 bg-[#f9fafb] z-30">
          {/* Tools */}
          <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />

          <div className="flex gap-1">
            <button onClick={() => imageInputRef.current?.click()} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors shadow-sm">
              <Image className="w-5 h-5" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors shadow-sm">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          {/* Capture Button */}
          <button
            onClick={() => handleSubmit()}
            disabled={!text.trim() && attachments.length === 0}
            className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white rounded-2xl text-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Capture
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <Routes>
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
