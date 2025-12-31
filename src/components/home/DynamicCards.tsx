import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, MessageSquareQuote, CheckSquare, Target, ArrowRight, HelpCircle, AlertCircle, ExternalLink, Zap, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DynamicCardData, CardAction } from '../../hooks/use-home-data';
import { cn } from '@/lib/utils';
import { useActionState } from '@/hooks/use-action-state';

interface CardProps {
    data: DynamicCardData & {
        feed_item_id?: string;
        related_task_id?: string | null;
        related_commitment_id?: string | null;
        generation_reason?: string;
        priority_score?: number;
        expires_at?: number | null;
        metadata?: any;
    };
    onAction: (action: CardAction['action']) => void;
}

function BaseCard({ 
    children, 
    className = '', 
    generationReason,
    priorityScore,
    expiresAt,
    relatedTaskId,
    relatedCommitmentId,
    cardId,
    actionState
}: { 
    children: React.ReactNode, 
    className?: string, 
    generationReason?: string,
    priorityScore?: number,
    expiresAt?: number | null,
    relatedTaskId?: string | null,
    relatedCommitmentId?: string | null,
    cardId?: string,
    actionState?: { status: 'pending' | 'syncing' | 'synced' | 'error' }
}) {
    const navigate = useNavigate();
    const [showWhy, setShowWhy] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    // Calculate priority border styling (visual only, not displayed)
    const hasExpired = expiresAt && expiresAt < Date.now();
    const isExpiringSoon = expiresAt && expiresAt > Date.now() && expiresAt < Date.now() + 24 * 60 * 60 * 1000;
    
    // Priority-based border color and shadow (subtle visual indicator)
    const priorityBorderClass = priorityScore && priorityScore > 0.7 
        ? "border-amber-200" 
        : priorityScore && priorityScore > 0.4 
        ? "border-zinc-200"
        : "border-zinc-200/80";
    
    const priorityShadow = priorityScore && priorityScore > 0.7 
        ? "shadow-[0_2px_12px_-4px_rgba(251,191,36,0.2)]" 
        : priorityScore && priorityScore > 0.4 
        ? "shadow-sm"
        : "";

    // Action state styling
    const actionStatus = actionState?.status;
    const isPending = actionStatus === 'pending';
    const isSyncing = actionStatus === 'syncing';
    const isSynced = actionStatus === 'synced';

    // Handle fade out when synced
    useEffect(() => {
        if (isSynced && !isFadingOut) {
            setIsFadingOut(true);
        }
    }, [isSynced, isFadingOut]);

    return (
        <div className={cn(
            "relative p-5 rounded-2xl bg-white border transition-all",
            className,
            "group",
            priorityBorderClass,
            priorityShadow,
            // Action state styling
            isPending && "opacity-70 border-blue-200",
            isSyncing && "opacity-80 border-blue-300",
            isSynced && "opacity-0 -translate-y-2 pointer-events-none transition-all duration-[400ms] ease-out",
            // Hover only when not in action state
            !actionStatus && "hover:shadow-md"
        )}>
            {/* Checkmark when synced */}
            {isSynced && (
                <div className="absolute top-4 right-4 z-10">
                    <div className="w-8 h-8 rounded-full bg-[#34c759] flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                </div>
            )}

            {/* Syncing indicator */}
            {isSyncing && (
                <div className="absolute top-4 right-4 z-10">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    </div>
                </div>
            )}

            {/* Pending indicator */}
            {isPending && (
                <div className="absolute top-4 right-4 z-10">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                </div>
            )}
            {/* Why this? button - only show if there's a generation reason */}
            {generationReason && (
                <button
                    onClick={() => setShowWhy(!showWhy)}
                    className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-all"
                    aria-label="Why am I seeing this?"
                >
                    <HelpCircle className="w-4 h-4" />
                </button>
            )}

            {/* Why this? tooltip */}
            {showWhy && generationReason && (
                <div className="absolute top-12 right-3 z-10 p-3 bg-zinc-900 text-white text-sm rounded-xl shadow-lg max-w-[240px] animate-in fade-in slide-in-from-top-2">
                    <p className="leading-relaxed font-medium mb-1">Why this?</p>
                    <p className="leading-relaxed text-zinc-300">{generationReason}</p>
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-zinc-900 rotate-45" />
                </div>
            )}

            {/* User-friendly links and indicators */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                {isExpiringSoon && !hasExpired && (
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1.5 border border-amber-200/50">
                        <Clock className="w-3 h-3" />
                        <span>Due soon</span>
                    </span>
                )}
                {hasExpired && (
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 flex items-center gap-1.5 border border-red-200/50">
                        <AlertCircle className="w-3 h-3" />
                        <span>Expired</span>
                    </span>
                )}
                {relatedCommitmentId && (
                    <button
                        onClick={() => navigate('/commitments')}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center gap-1.5 border border-purple-200/50 transition-colors"
                    >
                        <Target className="w-3 h-3" />
                        <span>View Commitment</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                )}
            </div>

            {children}
        </div>
    );
}

function ActionButton({ action, onClick, variant }: { action: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger' }) {
    if (variant === 'primary') {
        return (
            <button
                onClick={onClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-[13px] font-medium rounded-xl hover:bg-zinc-800 active:scale-95 transition-all shadow-sm"
            >
                {action}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
        );
    }
    return (
        <button
            onClick={onClick}
            className="px-4 py-2.5 text-zinc-600 text-[13px] font-medium rounded-xl hover:bg-zinc-50 hover:text-zinc-900 transition-all"
        >
            {action}
        </button>
    );
}

export function FocusCard({ data, onAction }: CardProps) {
    const { getActionState } = useActionState();
    const actionState = getActionState(data.feed_item_id || data.id);

    return (
        <BaseCard 
            generationReason={data.generation_reason}
            priorityScore={data.priority_score}
            expiresAt={data.expires_at}
            relatedTaskId={data.related_task_id}
            relatedCommitmentId={data.related_commitment_id}
            cardId={data.feed_item_id || data.id}
            actionState={actionState}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm ring-1 ring-amber-100/50">
                        <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <p className="text-[15px] text-zinc-600 leading-relaxed font-normal">{data.content}</p>

                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function TodoLiteCard({ data, onAction }: CardProps) {
    const { getActionState } = useActionState();
    const actionState = getActionState(data.feed_item_id || data.id);
    const items = Array.isArray(data.content) ? data.content : [data.content];

    return (
        <BaseCard 
            generationReason={data.generation_reason}
            priorityScore={data.priority_score}
            expiresAt={data.expires_at}
            relatedTaskId={data.related_task_id}
            relatedCommitmentId={data.related_commitment_id}
            cardId={data.feed_item_id || data.id}
            actionState={actionState}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-blue-100/50">
                        <CheckSquare className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <div className="space-y-1">
                    {items.map((item, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-2.5 -mx-2.5 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group/item">
                            <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                                <input type="checkbox" className="peer appearance-none w-5 h-5 border-[1.5px] border-zinc-300 rounded-md checked:bg-zinc-900 checked:border-zinc-900 transition-all" />
                                <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-all scale-50 peer-checked:scale-100" />
                            </div>
                            <span className="text-[14px] text-zinc-600 group-hover/item:text-zinc-900 transition-colors font-medium">{item}</span>
                        </label>
                    ))}
                </div>
                {/* Actions for Todo card usually 'Done' means dismiss whole card */}
                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function ReflectionCard({ data, onAction }: CardProps) {
    const { getActionState } = useActionState();
    const actionState = getActionState(data.feed_item_id || data.id);

    return (
        <BaseCard 
            generationReason={data.generation_reason}
            priorityScore={data.priority_score}
            expiresAt={data.expires_at}
            relatedTaskId={data.related_task_id}
            relatedCommitmentId={data.related_commitment_id}
            cardId={data.feed_item_id || data.id}
            actionState={actionState}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-100/50">
                        <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <div className="relative pl-4 border-l-2 border-indigo-100 py-1">
                    <p className="text-[15px] text-zinc-700 leading-relaxed font-normal italic">"{data.content}"</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function HabitCard({ data, onAction }: CardProps) {
    const { getActionState } = useActionState();
    const actionState = getActionState(data.feed_item_id || data.id);

    return (
        <BaseCard 
            generationReason={data.generation_reason}
            priorityScore={data.priority_score}
            expiresAt={data.expires_at}
            relatedTaskId={data.related_task_id}
            relatedCommitmentId={data.related_commitment_id}
            cardId={data.feed_item_id || data.id}
            actionState={actionState}
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5 shadow-sm ring-1 ring-emerald-100/50">
                    <Clock className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight mb-1">{data.title}</h3>
                    <p className="text-[14px] text-zinc-600 mb-3 leading-relaxed">{data.content}</p>

                    <div className="flex items-center gap-2">
                        {data.actions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => onAction(action.action)}
                                className={cn(
                                    "text-[12px] font-medium px-3 py-1.5 rounded-xl transition-colors",
                                    action.variant === 'secondary'
                                        ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                )}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </BaseCard>
    );
}

export function GoalCard({ data, onAction }: CardProps) {
    const { getActionState } = useActionState();
    const actionState = getActionState(data.feed_item_id || data.id);
    // Check if this is a potential commitment
    const isPotentialCommitment = data.metadata?.is_potential_commitment === true;
    
    return (
        <BaseCard 
            generationReason={data.generation_reason}
            priorityScore={data.priority_score}
            expiresAt={data.expires_at}
            relatedTaskId={data.related_task_id}
            relatedCommitmentId={data.related_commitment_id}
            cardId={data.feed_item_id || data.id}
            actionState={actionState}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm ring-1 ring-purple-100/50">
                        <Target className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                            {isPotentialCommitment && (
                                <span className="text-[10px] font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200/50">
                                    Potential
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-[15px] text-zinc-600 leading-relaxed font-normal">{data.content}</p>

                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}
