import { trpc } from '../lib/trpc';
import { format, formatDistanceToNow } from 'date-fns';
import { Target, Loader2, HelpCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useCapture } from '@/contexts/CaptureContext';

export default function CommitmentsPage() {
    const { data: commitments, isLoading } = trpc.commitments.list.useQuery({
        status: undefined,
        include_history: false,
    });
    const [explainedId, setExplainedId] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const { openCapture } = useCapture();

    // Filter commitments by status
    const activeCommitments = commitments?.filter(
        c => c.status === 'active' || c.status === 'confirmed'
    ) || [];
    
    const completedCommitments = commitments?.filter(
        c => c.status === 'completed' || c.status === 'retired'
    ) || [];

    const handleAction = (action: string, commitment: typeof activeCommitments[0] | typeof completedCommitments[0]) => {
        let prefillText = '';
        let eventType: 'commitment_acknowledge' | 'commitment_complete' | 'commitment_cancel' | undefined;
        
        switch (action) {
            case 'complete':
                prefillText = `Completed ${commitment.content}`;
                eventType = 'commitment_complete';
                break;
            case 'cancel':
                prefillText = `Cancelling ${commitment.content}. Why?`;
                eventType = 'commitment_cancel';
                break;
            case 'renegotiate':
                prefillText = `Renegotiating ${commitment.content}. What's changing?`;
                // Renegotiation will be handled via capture text parsing
                openCapture(prefillText, {
                    linked_commitment_id: commitment.id,
                });
                return;
        }

        if (eventType) {
            openCapture(prefillText, {
                event_type: eventType,
                linked_commitment_id: commitment.id,
            });
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-white">
                <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
            </div>
        );
    }

    if (activeCommitments.length === 0) {
        return (
            <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32 flex flex-col items-center justify-center text-center px-8">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-zinc-100">
                    <Target className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="text-zinc-900 font-medium tracking-tight text-lg">No active commitments</p>
                <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
                    Commitments you accept will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
                {/* Active Commitments */}
                {activeCommitments.map((commitment) => {
                    const strength = commitment.strength || 'medium';
                    const progressScore = commitment.progress_score || 0;
                    const lastAcknowledged = commitment.last_acknowledged_at 
                        ? new Date(commitment.last_acknowledged_at) 
                        : null;

                    return (
                        <div
                            key={commitment.id}
                            className="group relative p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-sm hover:shadow-md transition-all"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight">
                                            {commitment.content}
                                        </h3>
                                        <button
                                            onClick={() => setExplainedId(explainedId === commitment.id ? null : commitment.id)}
                                            className="opacity-0 group-hover:opacity-40 hover:opacity-100 text-zinc-400 hover:text-zinc-600 transition-opacity"
                                            aria-label="Why am I seeing this?"
                                        >
                                            <HelpCircle className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Explanation (shown when help icon clicked) */}
                                    {explainedId === commitment.id && (
                                        <div className="mt-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-sm text-zinc-600 leading-relaxed">
                                            This commitment was created from your entries. It reflects a pattern you've been working on.
                                        </div>
                                    )}

                                    {/* Strength Badge */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">
                                            {strength}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Subtle Progress Indicator */}
                            <div className="mb-4">
                                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-300 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(5, progressScore * 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Last Acknowledged Time */}
                            {lastAcknowledged && (
                                <div className="mb-4 text-xs text-zinc-400">
                                    Last acknowledged {formatDistanceToNow(lastAcknowledged, { addSuffix: true })}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                                <button
                                    onClick={() => handleAction('complete', commitment)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Complete</span>
                                </button>
                                <button
                                    onClick={() => handleAction('cancel', commitment)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-4 h-4" />
                                    <span>Retire</span>
                                </button>
                                <button
                                    onClick={() => handleAction('renegotiate', commitment)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors ml-auto"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span>Renegotiate</span>
                                </button>
                            </div>

                            {/* Metadata */}
                            <div className="mt-3 pt-3 border-t border-zinc-50 flex items-center gap-3 text-xs text-zinc-400">
                                <span>{format(new Date(commitment.created_at), 'MMM d, yyyy')}</span>
                            </div>
                        </div>
                    );
                })}
                
                {/* Completed Commitments - Collapsed Section */}
                {completedCommitments.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-zinc-200">
                        <button
                            onClick={() => setShowCompleted(!showCompleted)}
                            className="flex items-center gap-2 w-full text-left text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
                        >
                            {showCompleted ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                            <span>Completed ({completedCommitments.length})</span>
                        </button>
                        
                        {showCompleted && (
                            <div className="space-y-4">
                                {completedCommitments.map((commitment) => {
                                    const strength = commitment.strength || 'medium';
                                    
                                    return (
                                        <div
                                            key={commitment.id}
                                            className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/50 opacity-75"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-[15px] font-medium text-zinc-600 line-through">
                                                        {commitment.content}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-xs font-medium capitalize">
                                                            {strength}
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-xs font-medium capitalize">
                                                            {commitment.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-3 text-xs text-zinc-400">
                                                <span>{format(new Date(commitment.created_at), 'MMM d, yyyy')}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
