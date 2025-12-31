import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useUndo } from '@/hooks/use-undo';
import { cn } from '@/lib/utils';

export function UndoToast() {
    const { isShowing, performUndo, hideUndo } = useUndo();

    if (!isShowing) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-zinc-900 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 min-w-[200px]">
                <button
                    onClick={performUndo}
                    className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span>Undo</span>
                </button>
                <button
                    onClick={hideUndo}
                    className="ml-auto p-1 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}


