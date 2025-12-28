import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { format, isToday, startOfDay } from 'date-fns';
import { CheckCircle2, CheckSquare2, Circle, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'today' | 'upcoming' | 'completed' | 'all';

export default function TasksPage() {
    const [filter, setFilter] = useState<FilterType>('all');
    const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
        include_history: false,
    });

    // Filter and group tasks
    const filteredTasks = useMemo(() => {
        type Task = NonNullable<typeof tasks>[number];
        
        if (!tasks) {
            return { 
                today: [] as Task[], 
                upcoming: [] as Task[], 
                completed: [] as Task[], 
                all: [] as Task[] 
            };
        }

        const now = Date.now();
        const todayStart = startOfDay(new Date()).getTime();

        const grouped = {
            today: [] as Task[],
            upcoming: [] as Task[],
            completed: [] as Task[],
            all: tasks,
        };

        tasks.forEach(task => {
            if (task.status === 'completed' || task.status === 'cancelled') {
                grouped.completed.push(task);
            } else if (task.due_date) {
                const dueTime = new Date(task.due_date).getTime();
                if (dueTime >= todayStart && dueTime < todayStart + 86400000) {
                    grouped.today.push(task);
                } else if (dueTime > todayStart + 86400000) {
                    grouped.upcoming.push(task);
                } else {
                    // Past due but not completed
                    grouped.today.push(task);
                }
            } else {
                // No due date - show in today or upcoming based on status
                if (task.status === 'in_progress') {
                    grouped.today.push(task);
                } else {
                    grouped.upcoming.push(task);
                }
            }
        });

        return grouped;
    }, [tasks]);

    const displayTasks = filteredTasks[filter === 'all' ? 'all' : filter];

    const filters: { label: string; value: FilterType; count: number }[] = [
        { label: 'Today', value: 'today', count: filteredTasks.today.length },
        { label: 'Upcoming', value: 'upcoming', count: filteredTasks.upcoming.length },
        { label: 'Completed', value: 'completed', count: filteredTasks.completed.length },
    ];

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
            {/* Filter Tabs */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-zinc-100/80 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] px-6 py-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    {filters.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={cn(
                                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                                filter === f.value
                                    ? "bg-zinc-900 text-white shadow-sm"
                                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                            )}
                        >
                            {f.label}
                            {f.count > 0 && (
                                <span className={cn(
                                    "ml-2 px-1.5 py-0.5 rounded-full text-[10px]",
                                    filter === f.value
                                        ? "bg-white/20 text-white"
                                        : "bg-zinc-200 text-zinc-600"
                                )}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tasks List */}
            <div className="max-w-xl mx-auto px-6 py-6 space-y-3">
                {displayTasks.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 text-sm">
                        No tasks in this view
                    </div>
                ) : (
                    displayTasks.map((task) => {
                        const isCompleted = task.status === 'completed';
                        const isCancelled = task.status === 'cancelled';
                        const dueDate = task.due_date ? new Date(task.due_date) : null;
                        const isOverdue = dueDate && !isCompleted && !isCancelled && dueDate.getTime() < Date.now();

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "group relative p-4 rounded-2xl border transition-all",
                                    isCompleted || isCancelled
                                        ? "bg-zinc-50/50 border-zinc-100"
                                        : "bg-white border-zinc-200/80 shadow-sm hover:shadow-md hover:border-zinc-300"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Drag Handle (for future reorder) */}
                                    <button
                                        className="opacity-0 group-hover:opacity-30 text-zinc-400 hover:text-zinc-600 transition-opacity cursor-grab active:cursor-grabbing mt-1"
                                        aria-label="Reorder"
                                    >
                                        <GripVertical className="w-4 h-4" />
                                    </button>

                                    {/* Checkbox */}
                                    <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-zinc-400" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-zinc-300" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-[15px] leading-relaxed",
                                            isCompleted || isCancelled
                                                ? "text-zinc-400 line-through"
                                                : "text-zinc-900 font-medium"
                                        )}>
                                            {task.content}
                                        </p>

                                        {/* Metadata */}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                                            {task.priority && (
                                                <>
                                                    <span className="px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-600 font-medium">
                                                        {task.priority}
                                                    </span>
                                                </>
                                            )}
                                            {dueDate && (
                                                <span className={cn(
                                                    isOverdue && !isCompleted && !isCancelled
                                                        ? "text-amber-600"
                                                        : "text-zinc-400"
                                                )}>
                                                    {isToday(dueDate) ? 'Today' : format(dueDate, 'MMM d')}
                                                </span>
                                            )}
                                            {task.status && task.status !== 'pending' && (
                                                <span className="px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-600 capitalize">
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

