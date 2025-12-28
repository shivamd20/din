import { trpc } from '../../lib/trpc';
import { format } from 'date-fns';
import { useMemo } from 'react';

interface SignalsTimelineProps {
    includeHistory: boolean;
}

export function SignalsTimeline({ includeHistory }: SignalsTimelineProps) {
    const { data: signals, isLoading } = trpc.signals.list.useQuery({
        include_history: includeHistory,
    });

    // Group signals by entry_id and then by date
    // This hook must be called unconditionally (before any early returns)
    const groupedSignals = useMemo(() => {
        const grouped = new Map<string, Array<NonNullable<typeof signals>[number]>>();
        if (signals && signals.length > 0) {
            signals.forEach(signal => {
                const key = signal.entry_id;
                if (!grouped.has(key)) {
                    grouped.set(key, []);
                }
                grouped.get(key)!.push(signal);
            });
        }
        return grouped;
    }, [signals]);

    // Get entry details for display
    const entryIds = Array.from(groupedSignals.keys());

    if (isLoading) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">Loading signals...</div>
        );
    }

    if (!signals || signals.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">No signals found</div>
        );
    }

    return (
        <div className="space-y-6">
            {entryIds.map((entryId) => {
                const entrySignals = groupedSignals.get(entryId)!;
                const latestSignal = entrySignals[0]; // Already sorted by generated_at DESC
                const date = format(new Date(latestSignal.generated_at), 'MMM d, yyyy');

                return (
                    <div key={entryId} className="border-l-2 border-zinc-200 pl-4">
                        <div className="text-xs text-zinc-500 mb-2">{date}</div>
                        <div className="space-y-2">
                            {entrySignals.map((signal) => (
                                <div
                                    key={signal.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-700">{signal.key}:</span>
                                        <span className="text-zinc-600">{signal.value.toFixed(2)}</span>
                                        <span className="text-xs text-zinc-400">({(signal.value * 100).toFixed(0)}%)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                                        <span>v{signal.version}</span>
                                        {signal.confidence && (
                                            <span className="text-zinc-300">•</span>
                                        )}
                                        {signal.confidence && (
                                            <span>conf: {(signal.confidence * 100).toFixed(0)}%</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

