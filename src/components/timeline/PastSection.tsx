import { format, isToday, isYesterday } from 'date-fns';
import { CheckCircle2, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TimelineItem {
    id: string;
    content: string;
    status: 'completed' | 'missed' | 'adjusted';
    completed_at: number | null;
    time_spent_minutes: number;
    planned_duration_minutes: number;
    commitment_id: string | null;
    commitment_content: string | null;
    contextual_note: string | null;
    why_missed: string | null;
    contributed_to_streak: boolean;
    broke_streak: boolean;
    created_at: number;
}

interface PastSectionProps {
    items: TimelineItem[];
}

export function PastSection({ items }: PastSectionProps) {
    if (items.length === 0) {
        return null;
    }

    // Group by date
    const groupedByDate = items.reduce((acc, item) => {
        const date = item.completed_at || item.created_at;
        const dateKey = format(new Date(date), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, TimelineItem[]>);

    const sortedDates = Object.keys(groupedByDate).sort().reverse();

    return (
        <div className="mb-20">
            <h2 className="text-[17px] font-medium text-[#1d1d1f] mb-8">Past</h2>
            <div className="space-y-10">
                {sortedDates.map((dateKey) => {
                    const dateItems = groupedByDate[dateKey];
                    const date = new Date(dateKey);
                    const dateLabel = isToday(date) 
                        ? 'Today' 
                        : isYesterday(date)
                        ? 'Yesterday'
                        : format(date, 'MMMM d, yyyy');

                    return (
                        <div key={dateKey}>
                            <h3 className="text-[13px] font-medium text-[#86868b] mb-5">{dateLabel}</h3>
                            <div className="space-y-4">
                                {dateItems.map((item) => (
                                    <PastItem key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PastItem({ item }: { item: TimelineItem }) {
    const navigate = useNavigate();
    const date = item.completed_at ? new Date(item.completed_at) : new Date(item.created_at);
    const timeLabel = format(date, 'h:mm a');
    const isCompleted = item.status === 'completed';

    return (
        <div className="flex items-start gap-4 py-1">
            <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                ) : (
                    <Circle className="w-5 h-5 text-[#d1d1d6]" strokeWidth={1.5} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={isCompleted 
                    ? "text-[16px] leading-[1.47] text-[#1d1d1f]" 
                    : "text-[16px] leading-[1.47] text-[#86868b] line-through"
                }>
                    {item.content}
                </p>
                <div className="flex items-center gap-3 mt-2">
                    <p className="text-[13px] text-[#86868b]">
                        {timeLabel}
                    </p>
                    {item.commitment_content && (
                        <button
                            onClick={() => item.commitment_id && navigate(`/commitments/${item.commitment_id}`)}
                            className="text-[13px] text-[#007aff] hover:text-[#0051d5] transition-colors"
                        >
                            {item.commitment_content}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
