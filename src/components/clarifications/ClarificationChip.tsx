import React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClarificationChipProps {
    question: string;
    onClick: () => void;
    className?: string;
}

export function ClarificationChip({ question, onClick, className }: ClarificationChipProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 rounded-full text-xs font-medium transition-colors border border-zinc-200/50",
                className
            )}
        >
            <HelpCircle className="w-3 h-3" />
            <span>{question}</span>
        </button>
    );
}

