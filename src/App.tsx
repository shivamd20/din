import { useState, useEffect, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import { useSession, signOut } from './lib/auth-client';
import { LogOut } from 'lucide-react';

interface Entry {
  created_at: string;
  raw_text: string;
}

interface Summary {
  summary_text: string;
}

interface TodayData {
  entries: Entry[];
  summary?: Summary;
}

function ProtectedLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full max-w-lg mt-8 mb-4 flex justify-between items-center px-4 md:px-0">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-800">din</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 hidden sm:block">{session.user.name}</span>
          {session.user.image && <img src={session.user.image} alt="Profile" className="w-8 h-8 rounded-full border border-zinc-200" />}
          <button onClick={() => signOut()} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="w-full max-w-lg p-4 md:p-0">
        <Outlet />
      </main>
    </div>
  );
}

function DinApp() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [status, setStatus] = useState<'offline' | 'online' | 'error'>('offline');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const loadToday = async () => {
    try {
      const response = await fetch('/api/today');
      if (response.status === 401) {
        // handled by protected layout usually, but good to be safe
        return;
      }
      if (!response.ok) throw new Error('Failed to load');

      const data = await response.json() as TodayData;

      if (data.summary) {
        setSummary(data.summary.summary_text);
      } else {
        setSummary(null);
      }

      setEntries(data.entries || []);
      setStatus('online');
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  useEffect(() => {
    loadToday();
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (!response.ok) throw new Error('Failed to log');

      const result = await response.json();
      console.log("Logged:", result);

      setText('');
      await loadToday();
    } catch (error) {
      console.error(error);
      alert('Failed to log entry');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <section>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200 focus-within:ring-2 focus-within:ring-zinc-200 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-transparent resize-none outline-none text-base text-zinc-800 placeholder:text-zinc-400 min-h-[100px]"
            placeholder="What's on your mind?"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-50">
            <span className="text-xs text-zinc-400 font-medium">{text.length} chars</span>
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || !text.trim()}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Log Entry'}
            </button>
          </div>
        </div>
      </section>

      {summary && (
        <section className="animate-fade-in">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">AI Summary</h2>
          <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm text-zinc-700 leading-relaxed italic">
            "{summary}"
          </div>
        </section>
      )}

      <section className="space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-400 text-sm">No entries yet today.</p>
          </div>
        ) : (
          entries.slice().reverse().map((entry, index) => {
            const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={index} className="group p-4 rounded-xl bg-white border border-zinc-100 hover:border-zinc-200 shadow-sm transition-all hover:shadow-md animate-fade-in">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md">{time}</span>
                </div>
                <div className="text-zinc-800 whitespace-pre-wrap leading-relaxed">{entry.raw_text}</div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DinApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
