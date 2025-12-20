import { useState } from "react";
import { db } from "../lib/db";
import { syncQueue } from "../lib/sync";

export function ContextSuggestions({ entryId, onComplete }: { entryId: string, onComplete: () => void }) {
    const [step, setStep] = useState(0);
    // Hardcoded for now, as per spec "generated", but we need AI for real logic.
    // For Phase 1 "mocked/initial", rotating static chips is acceptable if offline.
    // Ideally these come from the server response if online, but offline-first means we might need local heuristics or just generic ones.
    const suggestions = [
        ["What did you eat?", "When was this?", "How did it feel?", "Anything unusual?"],
        ["Who were you with?", "Where were you?", "Energy level?"]
    ];

    const currentChips = suggestions[step % suggestions.length];

    const handleAppend = async (text: string) => {
        try {
            // Appending logic: fetch, append text, save.
            const entry = await db.entries.get(entryId);
            if (entry) {
                const newText = entry.text + "\n" + text;
                await db.entries.update(entryId, {
                    text: newText,
                    synced: 0
                });
                syncQueue();
            }

            if (step >= 1) { // Max 2 interactions (0, 1)
                onComplete();
            } else {
                setStep(s => s + 1);
            }
        } catch (e) {
            console.error("Failed to append context", e);
        }
    };

    return (
        <div className="mt-8 animate-fade-in w-full">
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Want to add more context?</h3>
            <div className="flex flex-wrap gap-2">
                {currentChips.map(chip => (
                    <button
                        key={chip}
                        onClick={() => handleAppend(chip)}
                        className="px-4 py-2 bg-white border border-zinc-200 rounded-full text-zinc-600 text-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95"
                    >
                        {chip}
                    </button>
                ))}
            </div>
            <button onClick={onComplete} className="mt-6 text-zinc-400 text-sm hover:text-zinc-600 underline">
                No, I'm done
            </button>
        </div>
    );
}
