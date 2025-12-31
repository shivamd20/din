import { trpc } from '../lib/trpc';
import { format, formatDistanceToNow } from 'date-fns';
import { Target, HelpCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle, RotateCcw, Flame, AlertCircle, TrendingDown, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useCapture } from '@/contexts/CaptureContext';
import { RevalidationIndicator } from './ui/RevalidationIndicator';
import { useNavigate } from 'react-router-dom';

export default function CommitmentsPage() {
    const { data: commitments, isRefetching, isFetching } = trpc.commitments.list.useQuery({
        status: undefined,
        include_history: false,
    });
    const [explainedId, setExplainedId] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const { openCapture } = useCapture();
    const navigate = useNavigate();

    // Filter commitments by status
    const activeCommitments = commitments?.filter(
        c => c.status === 'active' || c.status === 'confirmed'
    ) || [];
    
    const completedCommitments = commitments?.filter(
        c => c.status === 'completed' || c.status === 'retired'
    ) || [];

    const handleAction = (action: string, commitment: typeof activeCommitments[0] | typeof completedCommitments[0]) => {
        let actionTitle: string | undefined;
        let eventType: 'commitment_acknowledge' | 'commitment_cancel' | undefined;
        let guidedPrompt = '';
        
        switch (action) {
            case 'cancel':
                actionTitle = 'Retire Commitment';
                eventType = 'commitment_cancel';
                guidedPrompt = 'Why are you retiring this commitment?';
                break;
            case 'renegotiate':
                actionTitle = 'Renegotiate Commitment';
                guidedPrompt = 'What\'s changing about this commitment?';
                // Renegotiation will be handled via capture text parsing
                const renegotiateContext: Record<string, unknown> = {
                    action_taken: 'renegotiate',
                    action_title: actionTitle,
                    commitment_id: commitment.id,
                    commitment_content: commitment.content,
                    commitment_status: commitment.status,
                    guided_prompt: guidedPrompt,
                    ...(commitment.time_horizon_type && { time_horizon_type: commitment.time_horizon_type }),
                    ...(commitment.time_horizon_value && { time_horizon_value: commitment.time_horizon_value }),
                    ...(commitment.cadence_days && { cadence_days: commitment.cadence_days }),
                    ...(commitment.check_in_method && { check_in_method: commitment.check_in_method }),
                };
                openCapture('', {
                    linked_commitment_id: commitment.id,
                    action_type: 'renegotiate',
                    action_context: renegotiateContext,
                }, actionTitle);
                return;
        }

        if (eventType) {
            // Build comprehensive action context
            const actionContext: Record<string, unknown> = {
                action_taken: action,
                action_title: actionTitle,
                commitment_id: commitment.id,
                commitment_content: commitment.content,
                commitment_status: commitment.status,
                guided_prompt: guidedPrompt,
                ...(commitment.time_horizon_type && { time_horizon_type: commitment.time_horizon_type }),
                ...(commitment.time_horizon_value && { time_horizon_value: commitment.time_horizon_value }),
                ...(commitment.cadence_days && { cadence_days: commitment.cadence_days }),
                ...(commitment.check_in_method && { check_in_method: commitment.check_in_method }),
            };
            
            openCapture('', {
                event_type: eventType,
                linked_commitment_id: commitment.id,
                action_type: action,
                action_context: actionContext,
            }, actionTitle);
        }
    };

    // Show empty state only when we have no data and are not fetching
    if (!commitments && !isFetching) {
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
                {/* Revalidation Indicator */}
                <div className="sticky top-0 z-10 flex justify-end mb-4">
                    <RevalidationIndicator isRefetching={isRefetching} />
                </div>

                {activeCommitments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center px-8 py-12">
                        <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-zinc-100">
                            <Target className="w-8 h-8 text-zinc-300" />
                        </div>
                        <p className="text-zinc-900 font-medium tracking-tight text-lg">No active commitments</p>
                        <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
                            Commitments you accept will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                {/* Active Commitments */}
                {activeCommitments.map((commitment) => {
                    const strength = commitment.strength || 'medium';
                    const progressScore = commitment.progress_score || 0;
                    const lastAcknowledged = commitment.last_acknowledged_at 
                        ? new Date(commitment.last_acknowledged_at) 
                        : null;
                    
                    const healthStatus = commitment.health_status || 'on_track';
                    const statusConfig = {
                        on_track: { label: 'On Track', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
                        drifting: { label: 'Drifting', icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                        at_risk: { label: 'At Risk', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                        behind: { label: 'Behind', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                    };
                    const status = statusConfig[healthStatus as keyof typeof statusConfig] || statusConfig.on_track;
                    const StatusIcon = status.icon;

                    return (
                        <div
                            key={commitment.id}
                            className="group relative p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer"
                            onClick={() => navigate(`/commitments/${commitment.id}`)}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-[16px] font-semibold text-zinc-900 tracking-tight">
                                            {commitment.content}
                                        </h3>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExplainedId(explainedId === commitment.id ? null : commitment.id);
                                            }}
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

                                    {/* Badges */}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">
                                            {strength}
                                        </span>
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                                            status.bg,
                                            status.border,
                                            status.color
                                        )}>
                                            <StatusIcon className="w-3 h-3" />
                                            <span>{status.label}</span>
                                        </div>
                                        {commitment.streak_count && commitment.streak_count > 0 && (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium border border-orange-200">
                                                <Flame className="w-3 h-3" />
                                                <span>{commitment.streak_count} day streak</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>

                            {/* Next Step Preview */}
                            {commitment.next_step && (
                                <div className="mb-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-xs font-medium text-blue-900 mb-1">Next step:</p>
                                    <p className="text-sm text-blue-700">{commitment.next_step}</p>
                                </div>
                            )}

                            {/* Subtle Progress Indicator */}
                            <div className="mb-4">
                                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-300 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(5, (commitment.completion_percentage || progressScore * 100))}%` }}
                                    />
                                </div>
                                {commitment.completion_percentage !== null && (
                                    <div className="text-xs text-zinc-500 mt-1">
                                        {Math.round(commitment.completion_percentage)}% complete
                                    </div>
                                )}
                            </div>

                            {/* Last Acknowledged Time */}
                            {lastAcknowledged && (
                                <div className="mb-4 text-xs text-zinc-400">
                                    Last acknowledged {formatDistanceToNow(lastAcknowledged, { addSuffix: true })}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100" onClick={(e) => e.stopPropagation()}>
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
                    </>
                )}
            </div>
        </div>
    );
}
