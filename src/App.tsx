import { useState, useEffect, type FormEvent } from 'react';

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

function App() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'offline' | 'online' | 'error'>('offline');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const loadToday = async () => {
    try {
      const response = await fetch('/api/today');
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

  const getStatusColor = () => {
    if (isLoading) return "bg-yellow-400 animate-pulse";
    if (status === 'online') return "bg-green-500 scale-100";
    if (status === 'error') return "bg-red-500";
    return "bg-zinc-300";
  };

  return (
    <>
      <header className="w-full max-w-lg mb-8 flex justify-between items-center animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-800">din</h1>
        <div
          className={`w-2 h-2 rounded-full transition-all ${getStatusColor()}`}
          title={status}
        />
      </header>

      <main className="w-full max-w-lg space-y-8">
        {/* Input Section */}
        <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="glass-panel rounded-2xl p-4 focus-within:shadow-md bg-white border-zinc-200">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-transparent resize-none outline-none text-lg placeholder:text-zinc-400 min-h-[120px]"
              placeholder="How was your day?"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-zinc-400">{text.length}</span>
              <button
                onClick={() => handleSubmit()}
                disabled={isLoading || !text.trim()}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Logging...' : 'Log'}
              </button>
            </div>
          </div>
        </section>

        {/* Summary Section */}
        {summary && (
          <section className="animate-fade-in" style={{ animationDelay: '150ms' }}>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Today's Reflection</h2>
            <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm text-zinc-700 leading-relaxed">
              {summary}
            </div>
          </section>
        )}

        {/* History Section */}
        <section className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {entries.length === 0 ? (
            <p className="text-center text-zinc-400 text-sm">No entries yet today.</p>
          ) : (
            entries.slice().reverse().map((entry, index) => {
              const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={index} className="p-4 rounded-xl bg-white border border-zinc-100 shadow-sm transition-opacity animate-fade-in">
                  <div className="text-xs text-zinc-400 mb-1">{time}</div>
                  <div className="text-zinc-800 whitespace-pre-wrap">{entry.raw_text}</div>
                </div>
              );
            })
          )}
        </section>
      </main>

      <footer className="mt-auto py-8 text-center text-xs text-zinc-400">
        <p>&copy; {new Date().getFullYear()} Din</p>
      </footer>
    </>
  );
}

export default App;
