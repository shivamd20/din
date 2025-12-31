import { useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { format, isToday, isTomorrow, startOfDay, addDays } from 'date-fns';
import { CheckSquare2, Loader2, Play, MoreVertical, Clock, Target, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapture } from '@/contexts/CaptureContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Task type inferred from the API response
type Task = {
    id: string;
    content: string;
    status: string;
    planned_date: number | null;
    duration_minutes: number;
    preferred_window: string | null;
    commitment_id: string | null;
    [key: string]: unknown;
};

function TaskItem({ task, onAction }: { task: Task; onAction: (action: string, task: Task) => void }) {
    const [showMenu, setShowMenu] = useState(false);
    const navigate = useNavigate();
    const dueDate = task.planned_date ? new Date(task.planned_date) : null;
    const isCompleted = task.status === 'completed' || task.status === 'cancelled';
    const hasCommitment = task.commitment_id !== null && task.commitment_id !== undefined;

    return (
        <div className={cn(
            "group relative p-4 rounded-2xl border transition-all",
            isCompleted
                ? "bg-zinc-50/50 border-zinc-100"
                : "bg-white border-zinc-200/80 shadow-sm hover:shadow-md hover:border-zinc-300"
        )}>
            <div className="flex items-start gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "text-[15px] leading-relaxed",
                        isCompleted
                            ? "text-zinc-400 line-through"
                            : "text-zinc-900 font-medium"
                    )}>
                        {task.content}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400 flex-wrap">
                        {hasCommitment && (
                            <button
                                onClick={() => navigate('/commitments')}
                                className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-full border border-purple-200/50 transition-colors"
                            >
                                <Target className="w-3 h-3" />
                                <span>Commitment</span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                            </button>
                        )}
                        {task.duration_minutes && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.duration_minutes}m
                            </span>
                        )}
                        {task.preferred_window && (
                            <span className="px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-600 capitalize">
                                {task.preferred_window}
                            </span>
                        )}
                        {dueDate && (
                            <span className="text-zinc-400">
                                {isToday(dueDate) ? 'Today' : isTomorrow(dueDate) ? 'Tomorrow' : format(dueDate, 'MMM d')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {!isCompleted && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onAction('start', task)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                                aria-label="More options"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 z-20 min-w-[120px]">
                                        <button
                                            onClick={() => {
                                                onAction('snooze', task);
                                                setShowMenu(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                                        >
                                            Snooze
                                        </button>
                                        <button
                                            onClick={() => {
                                                onAction('skip', task);
                                                setShowMenu(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TaskSection({ title, tasks, onAction }: { title: string; tasks: Task[]; onAction: (action: string, task: Task) => void }) {
    if (tasks.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-2">
                {title}
            </h2>
            <div className="space-y-3">
                {tasks.map(task => (
                    <TaskItem key={task.id} task={task} onAction={onAction} />
                ))}
            </div>
        </div>
    );
}

export default function TasksPage() {
    const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
        include_history: false,
    });
    const { openCapture } = useCapture();
        
    // Group tasks into Today, Tomorrow, Later
    const groupedTasks = useMemo(() => {
        if (!tasks) {
            return { today: [], tomorrow: [], later: [] };
        }

        const now = Date.now();
        const todayStart = startOfDay(new Date()).getTime();
        const tomorrowStart = startOfDay(addDays(new Date(), 1)).getTime();
        const dayAfterStart = startOfDay(addDays(new Date(), 2)).getTime();

        const grouped = {
            today: [] as Task[],
            tomorrow: [] as Task[],
            later: [] as Task[],
        };

        tasks.forEach(task => {
            // Skip completed/cancelled tasks
            if (task.status === 'completed' || task.status === 'cancelled') {
                return;
            }

            if (task.planned_date) {
                const plannedTime = new Date(task.planned_date).getTime();
                if (plannedTime >= todayStart && plannedTime < tomorrowStart) {
                    grouped.today.push(task);
                } else if (plannedTime >= tomorrowStart && plannedTime < dayAfterStart) {
                    grouped.tomorrow.push(task);
                } else if (plannedTime >= dayAfterStart) {
                    grouped.later.push(task);
                } else {
                    // Past due - show in today
                    grouped.today.push(task);
                }
            } else {
                // No planned date - show in today if in progress, otherwise later
                if (task.status === 'started' || task.status === 'in_progress') {
                    grouped.today.push(task);
                } else {
                    grouped.later.push(task);
                }
            }
        });

        return grouped;
    }, [tasks]);

    const handleAction = (action: string, task: Task) => {
        let prefillText = '';
        let eventType: 'task_start' | 'task_snooze' | 'task_skip' | 'task_finish' | undefined;
        
        switch (action) {
            case 'start':
                prefillText = `Started ${task.content}`;
                eventType = 'task_start';
                break;
            case 'snooze':
                prefillText = `Snoozing ${task.content}. Snooze until?`;
                eventType = 'task_snooze';
                break;
            case 'skip':
                prefillText = `Skipping ${task.content}`;
                eventType = 'task_skip';
                break;
        }

        openCapture(prefillText, eventType ? {
            event_type: eventType,
            linked_task_id: task.id,
        } : undefined);
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-white">
                <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
            </div>
        );
    }

    if (!tasks || tasks.length === 0) {
        return (
            <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32 flex flex-col items-center justify-center text-center px-8">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-zinc-100">
                    <CheckSquare2 className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="text-zinc-900 font-medium tracking-tight text-lg">No tasks yet</p>
                <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
                    Tasks will appear here as you capture and plan.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            <div className="max-w-xl mx-auto px-6 py-6">
                <TaskSection title="Today" tasks={groupedTasks.today} onAction={handleAction} />
                <TaskSection title="Tomorrow" tasks={groupedTasks.tomorrow} onAction={handleAction} />
                <TaskSection title="Later" tasks={groupedTasks.later} onAction={handleAction} />
            </div>
        </div>
    );
}
