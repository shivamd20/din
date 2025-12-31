import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { useCapture } from '@/contexts/CaptureContext';

interface BlockerSectionProps {
    detectedBlockers: string[];
    commitmentId: string;
}

export function BlockerSection({ detectedBlockers, commitmentId }: BlockerSectionProps) {
    const { openCapture } = useCapture();
    const [userBlockers, setUserBlockers] = useState<string[]>([]);

    const commonBlockers = [
        'Unclear next step',
        'Lost motivation',
        'Waiting on someone',
        'Too big / overwhelming',
        'Forgot',
        'No time',
    ];

    const allBlockers = [...detectedBlockers, ...userBlockers];

    const handleAddBlocker = (blocker: string) => {
        if (!userBlockers.includes(blocker) && !detectedBlockers.includes(blocker)) {
            setUserBlockers([...userBlockers, blocker]);
            // Open capture to log the blocker
            const actionContext: Record<string, unknown> = {
                action_taken: 'add_blocker',
                action_title: 'Add Blocker',
                commitment_id: commitmentId,
                blocker: blocker,
                guided_prompt: 'Add any additional context about this blocker...',
            };
            openCapture('', {
                linked_commitment_id: commitmentId,
                action_type: 'add_blocker',
                action_context: actionContext,
            }, 'Add Blocker');
        }
    };

    const handleRemoveBlocker = (blocker: string) => {
        setUserBlockers(userBlockers.filter(b => b !== blocker));
    };

    if (allBlockers.length === 0 && userBlockers.length === 0) {
        return (
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-zinc-500" />
                    <h3 className="text-sm font-semibold text-zinc-900">What's stopping you?</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {commonBlockers.map((blocker) => (
                        <button
                            key={blocker}
                            onClick={() => handleAddBlocker(blocker)}
                            className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                            {blocker}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-semibold text-zinc-900">Detected Blockers</h3>
            </div>

            <div className="space-y-2 mb-4">
                {allBlockers.map((blocker, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-200"
                    >
                        <span className="text-sm text-zinc-700">{blocker}</span>
                        {userBlockers.includes(blocker) && (
                            <button
                                onClick={() => handleRemoveBlocker(blocker)}
                                className="p-1 hover:bg-zinc-100 rounded transition-colors"
                                aria-label="Remove blocker"
                            >
                                <X className="w-4 h-4 text-zinc-500" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="text-xs text-zinc-500">
                <p className="mb-2">Add another blocker:</p>
                <div className="flex flex-wrap gap-2">
                    {commonBlockers
                        .filter(b => !allBlockers.includes(b))
                        .map((blocker) => (
                            <button
                                key={blocker}
                                onClick={() => handleAddBlocker(blocker)}
                                className="px-2 py-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50 transition-colors"
                            >
                                {blocker}
                            </button>
                        ))}
                </div>
            </div>
        </div>
    );
}

