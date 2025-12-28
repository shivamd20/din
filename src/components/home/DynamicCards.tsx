import React, { useState } from 'react';
import { Play, CheckCircle2, Clock, X, MessageSquareQuote, CheckSquare, Zap, Target, ArrowRight, HelpCircle } from 'lucide-react';
import type { DynamicCardData, CardAction } from '../../hooks/use-home-data';
import { cn } from '@/lib/utils';

interface CardProps {
    data: DynamicCardData;
    onAction: (action: CardAction['action'], cardId: string) => void;
    onDismiss: (cardId: string) => void;
}

function BaseCard({ children, className = '', onDismiss, cardId, explanation }: { children: React.ReactNode, className?: string, onDismiss: (id: string) => void, cardId: string, explanation?: string }) {
    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div className={cn(
            "relative p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-sm transition-all hover:shadow-md",
            className,
            "group"
        )}>
            {/* Dismiss button */}
            <button
                onClick={() => onDismiss(cardId)}
                className="absolute top-3 right-3 p-1.5 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                aria-label="Dismiss"
            >
                <X className="w-3.5 h-3.5" />
            </button>

            {/* Why am I seeing this? button */}
            {explanation && (
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="absolute top-3 right-12 p-1.5 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Why am I seeing this?"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Explanation tooltip */}
            {showExplanation && explanation && (
                <div className="absolute top-12 right-3 z-10 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-lg max-w-[200px] animate-in fade-in slide-in-from-top-2">
                    <p className="leading-relaxed">{explanation}</p>
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-zinc-900 rotate-45" />
                </div>
            )}

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

export function FocusCard({ data, onAction, onDismiss }: CardProps) {
    const explanation = "This task matters most today based on your recent captures and priorities.";
    
    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id} explanation={explanation}>
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
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action, data.id)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function TodoLiteCard({ data, onAction, onDismiss }: CardProps) {
    const items = Array.isArray(data.content) ? data.content : [data.content];
    const explanation = "These tasks were extracted from your recent captures and organized for you.";

    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id} explanation={explanation}>
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
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action, data.id)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function ReflectionCard({ data, onAction, onDismiss }: CardProps) {
    const explanation = "This reflection is based on patterns in your recent entries.";

    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id} explanation={explanation}>
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
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action, data.id)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}

export function HabitCard({ data, onAction, onDismiss }: CardProps) {
    const explanation = "This habit suggestion comes from recurring patterns in your entries.";

    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id} explanation={explanation}>
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
                                onClick={() => onAction(action.action, data.id)}
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

export function GoalCard({ data, onAction, onDismiss }: CardProps) {
    const explanation = "This goal emerged from themes in your recent captures and commitments.";

    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id} explanation={explanation}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm ring-1 ring-purple-100/50">
                        <Target className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <p className="text-[15px] text-zinc-600 leading-relaxed font-normal">{data.content}</p>

                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action, data.id)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}
