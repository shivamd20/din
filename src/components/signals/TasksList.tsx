import { trpc } from '../../lib/trpc';
import { format } from 'date-fns';
import { useMemo } from 'react';

interface TasksListProps {
    includeHistory: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};

export function TasksList({ includeHistory }: TasksListProps) {
    const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
        include_history: includeHistory,
    });

    // Group tasks by status
    // This hook must be called unconditionally (before any early returns)
    const tasksByStatus = useMemo(() => {
        const grouped = new Map<string, Array<NonNullable<typeof tasks>[number]>>();
        if (tasks && tasks.length > 0) {
            tasks.forEach(task => {
                const status = task.status || 'pending';
                if (!grouped.has(status)) {
                    grouped.set(status, []);
                }
                grouped.get(status)!.push(task);
            });
        }
        return grouped;
    }, [tasks]);

    if (isLoading) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">Loading tasks...</div>
        );
    }

    if (!tasks || tasks.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">No tasks found</div>
        );
    }

    const statusOrder = ['pending', 'in_progress', 'completed', 'cancelled'];

    return (
        <div className="space-y-6">
            {statusOrder.map((status) => {
                const statusTasks = tasksByStatus.get(status);
                if (!statusTasks || statusTasks.length === 0) return null;

                return (
                    <div key={status}>
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3 capitalize">
                            {status.replace('_', ' ')} ({statusTasks.length})
                        </h3>
                        <div className="space-y-3">
                            {statusTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="border border-zinc-200 rounded-lg p-4 bg-white"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <p className="text-zinc-900 flex-1">{task.content}</p>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                                        <span>v{task.version}</span>
                                        {task.priority && (
                                            <>
                                                <span className="text-zinc-300">•</span>
                                                <span>Priority: {task.priority}</span>
                                            </>
                                        )}
                                        {task.due_date && (
                                            <>
                                                <span className="text-zinc-300">•</span>
                                                <span>Due: {format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                                            </>
                                        )}
                                        <span className="text-zinc-300">•</span>
                                        <span>{format(new Date(task.created_at), 'MMM d, yyyy')}</span>
                                    </div>
                                    {task.source_window_days && (
                                        <div className="text-xs text-zinc-400 mt-2">
                                            From {task.source_window_days}-day window
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

