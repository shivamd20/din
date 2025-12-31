import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSession, type Session } from './lib/auth-client';
import { syncQueue, pullFromServer } from './lib/sync';
import { trpcClient, queryClient, trpc } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import TimelinePage from './components/TimelinePage';
import ReflectChat from './components/ReflectChat';
import { Header } from './components/layout/Header';
import { WelcomeScreen } from './components/WelcomeScreen';
import { BottomNav } from './components/layout/BottomNav';

function ProtectedLayout() {
  const { data: session, isPending, error } = useSession();

  // Offline Auth: Fallback to cached session
  const [cachedSession] = useState<Session | null>(() => {
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
    // Initial sync on load if online and authenticated
    if (session || cachedSession) {
      syncQueue();
      pullFromServer();
    }
  }, [session, cachedSession]);

  // Use cached session if real session fails (offline) or is pending but we have cache
  const effectiveSession = session || (error ? cachedSession : null) || (isPending ? cachedSession : null);

  // Show welcome screen if not authenticated
  if (!isPending && !effectiveSession?.user) {
    return <WelcomeScreen />;
  }

  // Show loading state only while checking auth
  if (isPending && !cachedSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-zinc-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If still no session after loading, show welcome
  if (!effectiveSession?.user) {
    return <WelcomeScreen />;
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
import TasksPage from './components/TasksPage';
import CommitmentsPage from './components/CommitmentsPage';
import CommitmentDetailPage from './components/CommitmentDetailPage';
import { CaptureProvider } from './contexts/CaptureContext';
import { CaptureBox } from './components/features/CaptureBox';
import { UndoProvider } from './hooks/use-undo';
import { UndoToast } from './components/ui/UndoToast';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <CaptureProvider>
          <UndoProvider>
            <BrowserRouter>
              <Routes>
                {/* OAuth callback handler - must be before ProtectedLayout */}
                <Route path="/api/auth/callback/*" element={<AuthCallbackHandler />} />
                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/chat/:chatId?" element={<ReflectChat />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/commitments" element={<CommitmentsPage />} />
                  <Route path="/commitments/:commitmentId" element={<CommitmentDetailPage />} />
                  {/* Hidden behind hamburger menu */}
                  <Route path="/timeline" element={<TimelinePage />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <CaptureBox />
            <UndoToast />
          </UndoProvider>
        </CaptureProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
