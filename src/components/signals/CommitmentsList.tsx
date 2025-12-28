import { trpc } from '../../lib/trpc';
import { format } from 'date-fns';

interface CommitmentsListProps {
    includeHistory: boolean;
}

export function CommitmentsList({ includeHistory }: CommitmentsListProps) {
    const { data: commitments, isLoading } = trpc.commitments.list.useQuery({
        status: undefined, // Get all statuses, filter active/acknowledged in UI
        include_history: includeHistory,
    });

    if (isLoading) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">Loading commitments...</div>
        );
    }

    if (!commitments || commitments.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">No commitments found</div>
        );
    }

    // Filter for active or acknowledged commitments
    const activeCommitments = commitments.filter(
        c => c.status === 'active' || c.status === 'acknowledged'
    );

    if (activeCommitments.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">No active commitments</div>
        );
    }

    return (
        <div className="space-y-4">
            {activeCommitments.map((commitment) => (
                <div
                    key={commitment.id}
                    className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50"
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                            <p className="text-zinc-900 font-medium">{commitment.content || `${commitment.strength} commitment - ${commitment.horizon}`}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {commitment.status}
                                </span>
                                <span>v{commitment.version}</span>
                                <span>{format(new Date(commitment.created_at), 'MMM d, yyyy')}</span>
                            </div>
                        </div>
                    </div>
                    {commitment.source_window_days && (
                        <div className="text-xs text-zinc-400 mt-2">
                            From {commitment.source_window_days}-day window
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

