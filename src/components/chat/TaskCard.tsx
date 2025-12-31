import React from 'react';
import { CheckSquare, Clock, Target, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
    id: string;
    content: string;
    status: string;
    planned_date: number | null;
    duration_minutes: number;
    commitment_id: string | null;
    task_type: string;
    [key: string]: unknown;
}

interface TaskCardProps {
    task: Task;
}

const statusConfig = {
    planned: { label: 'Planned', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    started: { label: 'Started', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    paused: { label: 'Paused', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    completed: { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    abandoned: { label: 'Abandoned', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

export function TaskCard({ task }: TaskCardProps) {
    const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.planned;
    
    const plannedDate = task.planned_date ? new Date(task.planned_date) : null;
    const formattedDate = plannedDate?.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    const duration = task.duration_minutes > 0 
        ? task.duration_minutes < 60
            ? `${task.duration_minutes}m`
            : `${Math.floor(task.duration_minutes / 60)}h ${task.duration_minutes % 60}m`
        : null;

    return (
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-100/50 shrink-0">
                    <CheckSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-zinc-900 leading-relaxed">
                        {task.content}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-zinc-100">
                <div className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
                    status.bg,
                    status.color,
                    status.border,
                    "border"
                )}>
                    <span>{status.label}</span>
                </div>

                {plannedDate && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                    </div>
                )}

                {duration && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{duration}</span>
                    </div>
                )}

                {task.commitment_id && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Target className="w-3.5 h-3.5" />
                        <span>Linked to commitment</span>
                    </div>
                )}

                {task.task_type && (
                    <div className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs">
                        {task.task_type}
                    </div>
                )}
            </div>
        </div>
    );
}

