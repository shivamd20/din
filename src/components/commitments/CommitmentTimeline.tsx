import { trpc } from '@/lib/trpc';
import { CheckCircle2, Circle } from 'lucide-react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommitmentTimelineProps {
    commitmentId: string;
}

export function CommitmentTimeline({ commitmentId }: CommitmentTimelineProps) {
    const { data: tasks } = trpc.tasks.list.useQuery({
        include_history: false,
    });

    const commitmentTasks = tasks?.filter(t => t.commitment_id === commitmentId) || [];
    
    // Separate tasks by time
    const now = Date.now();
    const pastTasks = commitmentTasks.filter(t => 
        t.status === 'completed' || (t.planned_date && t.planned_date < now)
    );
    const todayTasks = commitmentTasks.filter(t => 
        t.planned_date && isToday(new Date(t.planned_date)) && t.status !== 'completed'
    );
    const futureTasks = commitmentTasks.filter(t => 
        t.planned_date && isFuture(new Date(t.planned_date)) && t.status !== 'completed'
    );

    if (commitmentTasks.length === 0) {
        return (
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200">
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">Timeline</h3>
                <p className="text-sm text-zinc-500">No tasks yet. Tasks will appear here as they're generated.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Timeline</h3>

            {/* Past Tasks */}
            {pastTasks.length > 0 && (
                <div>
                    <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Past</h4>
                    <div className="space-y-2">
                        {pastTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200"
                            >
                                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 line-through">
                                        {task.content}
                                    </p>
                                    {task.planned_date && (
                                        <p className="text-xs text-zinc-500 mt-1">
                                            {format(new Date(task.planned_date), 'MMM d, yyyy')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Today's Tasks */}
            {todayTasks.length > 0 && (
                <div>
                    <h4 className="text-xs font-medium text-blue-600 mb-2 uppercase tracking-wide">Today</h4>
                    <div className="space-y-2">
                        {todayTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200"
                            >
                                <Circle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900">
                                        {task.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Future Tasks */}
            {futureTasks.length > 0 && (
                <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Planned</h4>
                    <div className="space-y-2">
                        {futureTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200 opacity-60"
                            >
                                <Circle className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-600">
                                        {task.content}
                                    </p>
                                    {task.planned_date && (
                                        <p className="text-xs text-zinc-400 mt-1">
                                            {format(new Date(task.planned_date), 'MMM d, yyyy')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

