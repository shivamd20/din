import { trpc } from '@/lib/trpc';
import { CheckCircle2, Circle } from 'lucide-react';
import { format, startOfDay, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, isPast, isFuture, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface CadenceTimelineProps {
    commitmentId: string;
    commitment: {
        time_horizon_type: string | null;
        time_horizon_value: number | null;
        cadence_days: number | null;
        created_at: number;
        expires_at: number | null;
        streak_count: number | null;
    };
}

export function CadenceTimeline({ commitmentId, commitment }: CadenceTimelineProps) {
    const { data: tasks } = trpc.tasks.list.useQuery({
        include_history: true,
    });

    const commitmentTasks = tasks?.filter(t => t.commitment_id === commitmentId) || [];
    const completedTaskDates = new Set(
        commitmentTasks
            .filter(t => t.status === 'completed' && t.planned_date)
            .map(t => format(new Date(t.planned_date!), 'yyyy-MM-dd'))
    );

    if (!commitment.time_horizon_type) {
        return (
            <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
                <h3 className="text-[17px] font-medium text-[#1d1d1f] mb-2">Cadence</h3>
                <p className="text-[15px] text-[#86868b]">No cadence pattern defined for this commitment.</p>
            </div>
        );
    }

    const now = Date.now();
    const today = startOfDay(new Date(now));

    switch (commitment.time_horizon_type) {
        case 'daily':
            return <DailyCadence today={today} completedDates={completedTaskDates} streakCount={commitment.streak_count} />;
        case 'weekly':
            return <WeeklyCadence today={today} completedDates={completedTaskDates} cadenceDays={commitment.cadence_days || 7} />;
        case 'monthly':
            return <MonthlyCadence today={today} completedDates={completedTaskDates} cadenceDays={commitment.cadence_days || 30} />;
        case 'date':
            return <DateBasedCadence 
                today={today} 
                startDate={new Date(commitment.created_at)} 
                deadline={commitment.time_horizon_value ? new Date(commitment.time_horizon_value) : null}
                completedDates={completedTaskDates}
            />;
        default:
            return (
                <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
                    <h3 className="text-[17px] font-medium text-[#1d1d1f] mb-2">Cadence</h3>
                    <p className="text-[15px] text-[#86868b]">Pattern: {commitment.time_horizon_type}</p>
                </div>
            );
    }
}

function DailyCadence({ today, completedDates, streakCount }: { today: Date; completedDates: Set<string>; streakCount: number | null }) {
    const days: Date[] = [];
    // Last 30 days
    for (let i = 30; i >= 1; i--) {
        days.push(startOfDay(addDays(today, -i)));
    }
    // Next 14 days
    for (let i = 1; i <= 14; i++) {
        days.push(startOfDay(addDays(today, i)));
    }

    return (
        <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-medium text-[#1d1d1f]">Daily Pattern</h3>
                {streakCount && streakCount > 0 && (
                    <span className="text-[13px] text-[#86868b]">{streakCount} day streak</span>
                )}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const isCompleted = completedDates.has(dateKey);
                    const isTodayDate = isToday(day);
                    const isPastDate = isPast(day) && !isTodayDate;
                    const isFutureDate = isFuture(day);

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "aspect-square rounded-lg flex items-center justify-center text-[11px]",
                                isTodayDate && "ring-2 ring-[#007aff]",
                                isCompleted && "bg-[#34c759] text-white",
                                !isCompleted && isPastDate && "bg-[#d1d1d6] text-[#86868b]",
                                !isCompleted && isFutureDate && "bg-white border border-[#e5e5e7] text-[#86868b]"
                            )}
                            title={format(day, 'MMM d, yyyy')}
                        >
                            {isCompleted ? (
                                <CheckCircle2 className="w-3 h-3" />
                            ) : (
                                <span>{format(day, 'd')}</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="text-[13px] text-[#86868b] mt-3">Last 30 days • Next 14 days</p>
        </div>
    );
}

function WeeklyCadence({ today, completedDates, cadenceDays }: { today: Date; completedDates: Set<string>; cadenceDays: number }) {
    const weeks: { start: Date; end: Date; dates: Date[] }[] = [];
    // Last 8 weeks
    for (let i = 8; i >= 1; i--) {
        const weekStart = startOfWeek(addWeeks(today, -i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const dates: Date[] = [];
        for (let d = 0; d < 7; d++) {
            dates.push(addDays(weekStart, d));
        }
        weeks.push({ start: weekStart, end: weekEnd, dates });
    }
    // Next 8 weeks
    for (let i = 1; i <= 8; i++) {
        const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const dates: Date[] = [];
        for (let d = 0; d < 7; d++) {
            dates.push(addDays(weekStart, d));
        }
        weeks.push({ start: weekStart, end: weekEnd, dates });
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
            <h3 className="text-[17px] font-medium text-[#1d1d1f] mb-4">Weekly Pattern</h3>
            <div className="space-y-3">
                {weeks.map((week, weekIdx) => {
                    const weekKey = format(week.start, 'yyyy-MM-dd');
                    const hasCompletion = week.dates.some(d => completedDates.has(format(d, 'yyyy-MM-dd')));
                    
                    return (
                        <div key={weekIdx} className="space-y-1">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium text-[#86868b]">
                                    {format(week.start, 'MMM d')} - {format(week.end, 'MMM d')}
                                </span>
                                {hasCompletion && (
                                    <CheckCircle2 className="w-3 h-3 text-[#34c759]" />
                                )}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {week.dates.map((day, dayIdx) => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const isCompleted = completedDates.has(dateKey);
                                    const isTodayDate = isToday(day);
                                    
                                    return (
                                        <div
                                            key={dayIdx}
                                            className={cn(
                                                "aspect-square rounded flex items-center justify-center text-[10px]",
                                                isTodayDate && "ring-1 ring-[#007aff]",
                                                isCompleted && "bg-[#34c759] text-white",
                                                !isCompleted && "bg-white border border-[#e5e5e7] text-[#86868b]"
                                            )}
                                            title={format(day, 'MMM d, yyyy')}
                                        >
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                            ) : (
                                                <span>{dayNames[dayIdx][0]}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MonthlyCadence({ today, completedDates, cadenceDays }: { today: Date; completedDates: Set<string>; cadenceDays: number }) {
    const months: { start: Date; end: Date; dates: Date[] }[] = [];
    // Last 6 months
    for (let i = 6; i >= 1; i--) {
        const monthStart = startOfMonth(addMonths(today, -i));
        const monthEnd = endOfMonth(monthStart);
        const dates: Date[] = [];
        let current = monthStart;
        while (current <= monthEnd) {
            dates.push(startOfDay(current));
            current = addDays(current, 1);
        }
        months.push({ start: monthStart, end: monthEnd, dates });
    }
    // Next 6 months
    for (let i = 1; i <= 6; i++) {
        const monthStart = startOfMonth(addMonths(today, i));
        const monthEnd = endOfMonth(monthStart);
        const dates: Date[] = [];
        let current = monthStart;
        while (current <= monthEnd) {
            dates.push(startOfDay(current));
            current = addDays(current, 1);
        }
        months.push({ start: monthStart, end: monthEnd, dates });
    }

    return (
        <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
            <h3 className="text-[17px] font-medium text-[#1d1d1f] mb-4">Monthly Pattern</h3>
            <div className="space-y-4">
                {months.map((month, monthIdx) => {
                    const hasCompletion = month.dates.some(d => completedDates.has(format(d, 'yyyy-MM-dd')));
                    
                    return (
                        <div key={monthIdx} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] font-medium text-[#1d1d1f]">
                                    {format(month.start, 'MMMM yyyy')}
                                </span>
                                {hasCompletion && (
                                    <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
                                )}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {month.dates.slice(0, 35).map((day, dayIdx) => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const isCompleted = completedDates.has(dateKey);
                                    const isTodayDate = isToday(day);
                                    
                                    return (
                                        <div
                                            key={dayIdx}
                                            className={cn(
                                                "aspect-square rounded flex items-center justify-center text-[10px]",
                                                isTodayDate && "ring-1 ring-[#007aff]",
                                                isCompleted && "bg-[#34c759] text-white",
                                                !isCompleted && "bg-white border border-[#e5e5e7] text-[#86868b]"
                                            )}
                                            title={format(day, 'MMM d, yyyy')}
                                        >
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                            ) : (
                                                <span>{format(day, 'd')}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DateBasedCadence({ today, startDate, deadline, completedDates }: { today: Date; startDate: Date; deadline: Date | null; completedDates: Set<string> }) {
    if (!deadline) {
        return (
            <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
                <h3 className="text-[17px] font-medium text-[#1d1d1f] mb-2">Timeline</h3>
                <p className="text-[15px] text-[#86868b]">No deadline set.</p>
            </div>
        );
    }

    const totalDays = differenceInDays(deadline, startDate);
    const daysRemaining = differenceInDays(deadline, today);
    const progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100));

    // Show milestone markers
    const milestones = [
        { label: 'Start', date: startDate },
        { label: '25%', date: addDays(startDate, Math.floor(totalDays * 0.25)) },
        { label: '50%', date: addDays(startDate, Math.floor(totalDays * 0.5)) },
        { label: '75%', date: addDays(startDate, Math.floor(totalDays * 0.75)) },
        { label: 'Deadline', date: deadline },
    ];

    return (
        <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-medium text-[#1d1d1f]">Timeline</h3>
                <span className="text-[13px] text-[#86868b]">
                    {daysRemaining > 0 ? `${daysRemaining} days left` : 'Past deadline'}
                </span>
            </div>
            
            {/* Progress bar */}
            <div className="mb-6">
                <div className="h-2 bg-[#e5e5e7] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#34c759] rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-[#86868b]">
                    <span>{format(startDate, 'MMM d')}</span>
                    <span>{format(deadline, 'MMM d')}</span>
                </div>
            </div>

            {/* Milestones */}
            <div className="space-y-3">
                {milestones.map((milestone, idx) => {
                    const isCompleted = isPast(milestone.date) || isToday(milestone.date);
                    const isCurrent = isToday(milestone.date);
                    
                    return (
                        <div key={idx} className="flex items-center gap-3">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0",
                                isCompleted && "bg-[#34c759] text-white",
                                !isCompleted && isCurrent && "bg-[#007aff] text-white",
                                !isCompleted && !isCurrent && "bg-white border-2 border-[#e5e5e7] text-[#86868b]"
                            )}>
                                {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <span>{idx + 1}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-medium text-[#1d1d1f]">{milestone.label}</p>
                                <p className="text-[11px] text-[#86868b]">{format(milestone.date, 'MMM d, yyyy')}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

