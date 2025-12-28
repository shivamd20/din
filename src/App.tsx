import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSession, signIn, type Session } from './lib/auth-client';
import { syncQueue, pullFromServer } from './lib/sync';
import { trpcClient, queryClient, trpc } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import TimelinePage from './components/TimelinePage';
import SignalsPage from './components/SignalsPage';
import ReflectChat from './components/ReflectChat';
import { Header } from './components/layout/Header';

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

import HomePage from './components/HomePage';
import AuthCallbackHandler from './components/AuthCallbackHandler';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* OAuth callback handler - must be before ProtectedLayout */}
            <Route path="/api/auth/callback/*" element={<AuthCallbackHandler />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/reflect" element={<ReflectChat />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
