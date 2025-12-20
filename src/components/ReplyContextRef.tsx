import React from 'react';
import { Quote } from 'lucide-react';

interface ReplyContextRefProps {
    text: string;
    onDismiss: () => void;
}

export function ReplyContextRef({ text, onDismiss }: ReplyContextRefProps) {
    return (
        <div className="mx-4 mt-4 mb-2 p-3 bg-zinc-50 border-l-4 border-zinc-300 rounded-r-lg flex gap-3 relative animate-fade-in group">
            <Quote className="w-5 h-5 text-zinc-300 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Replying to</p>
                <p className="text-sm text-zinc-600 line-clamp-2 italic">"{text}"</p>
            </div>
            <button
                onClick={onDismiss}
                className="absolute top-2 right-2 p-1 text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-all"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    );
}
