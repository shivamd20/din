import { useState } from "react";

interface Suggestion {
    chipId: string;
    chipLabel: string;
    generationId: string;
}

export function ContextSuggestions({ suggestions, analysis, onReply, onComplete, loading }: {
    suggestions: Suggestion[],
    analysis?: string,
    onComplete: () => void,
    onReply: (chip: { label: string, id: string, generationId: string }) => void,
    loading?: boolean
}) {
    const [isVisible, setIsVisible] = useState(true);

    if (loading) {
        return (
            <div className="flex justify-center w-full py-4 animate-pulse">
                <span className="text-sm text-zinc-400 font-medium">Analyzing...</span>
            </div>
        );
    }

    const hasSuggestions = suggestions && suggestions.length > 0;
    if (!isVisible || (!hasSuggestions && !analysis)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 w-full animate-fade-in-up">
            {analysis && (
                <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-100 text-indigo-700 text-sm font-medium text-center shadow-sm">
                    {analysis}
                </div>
            )}
            {hasSuggestions && (
                <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((s) => (
                        <button
                            key={s.chipId}
                            onClick={() => onReply({ label: s.chipLabel, id: s.chipId, generationId: s.generationId })}
                            className="px-4 py-2 bg-white border border-indigo-100 shadow-sm rounded-full text-indigo-600 font-medium hover:bg-indigo-50 active:scale-95 transition-all text-sm"
                        >
                            {s.chipLabel}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex justify-center mt-2">
                <button
                    onClick={onComplete}
                    className="text-xs text-gray-400 hover:text-gray-600 underline decoration-dotted"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}
