import React, { useState, useEffect, type FormEvent, useRef, type ChangeEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSession, signIn, type Session } from './lib/auth-client';
import { Image, Paperclip } from 'lucide-react';
import { db, type Attachment } from './lib/db';
import { syncQueue, pullFromServer } from './lib/sync';
import { v4 as uuidv4 } from 'uuid';
import { trpcClient, queryClient, trpc } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import TimelinePage from './components/TimelinePage';
import ReflectChat from './components/ReflectChat';
import { Header } from './components/layout/Header';
import { GuestBanner } from './components/layout/GuestBanner';
import { getMicrocopy } from './lib/microcopy';

import { BottomNav } from './components/layout/BottomNav';

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
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm text-zinc-400">Loading...</div>;
  }

  // If we are still waiting for implicit login to complete
  if (!effectiveSession?.user) {
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm text-zinc-400">Initializing...</div>;
  }

  const user = effectiveSession.user;

  return (
    <div className="h-[100dvh] w-full bg-white text-zinc-900 flex flex-col font-sans overflow-hidden">
      <Header user={user} />

      {/* Main Content Area - with padding for top/bottom bars */}
      <main className="flex-1 w-full max-w-lg mx-auto pt-14 pb-20 overflow-hidden relative flex flex-col">
        <Outlet context={{ user }} />
      </main>

      <BottomNav />
    </div>
  );
}

import { Composer } from './components/features/Composer';

function DinApp() {
  const [layoutState, setLayoutState] = useState<'IDLE' | 'CAPTURED'>('IDLE');
  const [confirmationMsg, setConfirmationMsg] = useState("Captured.");

  const handleCapture = () => {
    setLayoutState('CAPTURED');
    setConfirmationMsg(getMicrocopy('CONFIRMATION'));
    setTimeout(() => {
      setLayoutState('IDLE');
    }, 1500);
  };

  return (
    <div className="flex-1 w-full bg-white relative flex flex-col h-full">
      {layoutState === 'CAPTURED' ? (
        <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" />
          </div>
          <p className="text-xl font-medium text-zinc-800">{confirmationMsg}</p>
        </div>
      ) : (
        <Composer onCapture={handleCapture} />
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
              <Route path="/reflect" element={<ReflectChat />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
