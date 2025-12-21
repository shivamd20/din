import React from 'react';
import { Play, CheckCircle2, Clock, X, MessageSquareQuote, CheckSquare, Zap, Target, ArrowRight } from 'lucide-react';
import type { DynamicCardData, CardAction } from '../../hooks/use-home-data';

interface CardProps {
    data: DynamicCardData;
    onAction: (action: CardAction['action'], cardId: string) => void;
    onDismiss: (cardId: string) => void;
}

function BaseCard({ children, className = '', onDismiss, cardId }: { children: React.ReactNode, className?: string, onDismiss: (id: string) => void, cardId: string }) {
    return (
        <div className={`relative p-6 rounded-3xl bg-white border border-zinc-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] ${className} group`}>
            <button
                onClick={() => onDismiss(cardId)}
                className="absolute top-4 right-4 p-1.5 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
            >
                <X className="w-3.5 h-3.5" />
            </button>
            {children}
        </div>
    );
}

function ActionButton({ action, onClick, variant }: { action: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger' }) {
    if (variant === 'primary') {
        return (
            <button
                onClick={onClick}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[13px] font-medium rounded-full hover:bg-zinc-800 active:scale-95 transition-all shadow-sm"
            >
                {action}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
        );
    }
    return (
        <button
            onClick={onClick}
            className="px-4 py-2 text-zinc-500 text-[13px] font-medium rounded-full hover:bg-zinc-50 hover:text-zinc-900 transition-all"
        >
            {action}
        </button>
    );
}

export function FocusCard({ data, onAction, onDismiss }: CardProps) {
    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 ring-4 ring-orange-50/50">
                        <Zap className="w-4 h-4 fill-current" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <p className="text-[15px] text-zinc-500 leading-relaxed font-normal">{data.content}</p>

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

    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 ring-4 ring-blue-50/50">
                        <CheckSquare className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <div className="space-y-0.5">
                    {items.map((item, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-2.5 -mx-2.5 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group/item">
                            <div className="relative flex items-center justify-center w-5 h-5">
                                <input type="checkbox" className="peer appearance-none w-5 h-5 border-[1.5px] border-zinc-300 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-all" />
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
    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 ring-4 ring-indigo-50/50">
                        <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <div className="relative pl-4 border-l-2 border-indigo-100 py-1">
                    <p className="text-[16px] text-zinc-800 leading-relaxed font-medium font-serif italic">"{data.content}"</p>
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
    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id}>
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-1">
                    <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight mb-1">{data.title}</h3>
                    <p className="text-[14px] text-zinc-500 mb-3">{data.content}</p>

                    <div className="flex items-center gap-2">
                        {data.actions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => onAction(action.action, data.id)}
                                className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${action.variant === 'secondary'
                                        ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
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
    return (
        <BaseCard onDismiss={onDismiss} cardId={data.id}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 ring-4 ring-purple-50/50">
                        <Target className="w-4 h-4" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">{data.title}</h3>
                </div>

                <p className="text-[15px] text-zinc-500 leading-relaxed">{data.content}</p>

                <div className="flex items-center gap-2 mt-1">
                    {data.actions.map((action, idx) => (
                        <ActionButton key={idx} action={action.label} variant={action.variant} onClick={() => onAction(action.action, data.id)} />
                    ))}
                </div>
            </div>
        </BaseCard>
    );
}
