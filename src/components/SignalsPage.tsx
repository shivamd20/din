import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { ArrowLeft } from 'lucide-react';
import { CommitmentsList } from './signals/CommitmentsList';
import { SignalsTimeline } from './signals/SignalsTimeline';
import { TasksList } from './signals/TasksList';

export default function SignalsPage() {
    const navigate = useNavigate();
    const [includeHistory, setIncludeHistory] = useState(false);

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/timeline')}
                        className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                        aria-label="Back to timeline"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600" />
                    </button>
                    <h1 className="text-xl font-semibold text-zinc-900">Signals and Commitments</h1>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includeHistory}
                        onChange={(e) => setIncludeHistory(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>Show Historical Versions</span>
                </label>
            </div>

            <div className="max-w-xl mx-auto px-6 py-6 space-y-12">
                {/* Active Commitments */}
                <section>
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">Active Commitments</h2>
                    <CommitmentsList includeHistory={includeHistory} />
                </section>

                {/* Signals Timeline */}
                <section>
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">Signals Timeline</h2>
                    <SignalsTimeline includeHistory={includeHistory} />
                </section>

                {/* Tasks with Status */}
                <section>
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">Tasks with Status</h2>
                    <TasksList includeHistory={includeHistory} />
                </section>
            </div>
        </div>
    );
}

