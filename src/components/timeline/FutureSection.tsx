import { format, isToday, isTomorrow, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface FutureProjection {
    id: string;
    content: string;
    projection_type: 'planned_by_system' | 'expected_milestone' | 'auto_prediction' | 'recurring_habit_slot';
    confidence_score: number;
    why_it_exists: string;
    when_materializes: number;
    related_commitment_id: string;
    related_commitment_content: string;
    pattern_marker?: string;
    cadence_days?: number;
}

interface FutureSectionProps {
    items: FutureProjection[];
}

export function FutureSection({ items }: FutureSectionProps) {
    if (items.length === 0) {
        return null;
    }

    // Group by week
    const groupedByWeek = items.reduce((acc, item) => {
        const date = new Date(item.when_materializes);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        if (!acc[weekKey]) {
            acc[weekKey] = [];
        }
        acc[weekKey].push(item);
        return acc;
    }, {} as Record<string, FutureProjection[]>);

    const sortedWeeks = Object.keys(groupedByWeek).sort();

    return (
        <div className="mb-20">
            <h2 className="text-[17px] font-medium text-[#1d1d1f] mb-8">Future</h2>
            <div className="space-y-10">
                {sortedWeeks.map((weekKey) => {
                    const weekItems = groupedByWeek[weekKey];
                    const weekStart = new Date(weekKey);
                    const weekLabel = `Week of ${format(weekStart, 'MMMM d')}`;

                    return (
                        <div key={weekKey}>
                            <h3 className="text-[13px] font-medium text-[#86868b] mb-5">{weekLabel}</h3>
                            <div className="space-y-4">
                                {weekItems.map((item) => (
                                    <FutureItem key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function FutureItem({ item }: { item: FutureProjection }) {
    const navigate = useNavigate();
    const date = new Date(item.when_materializes);
    const dateLabel = isToday(date)
        ? 'Today'
        : isTomorrow(date)
        ? 'Tomorrow'
        : format(date, 'MMM d');

    return (
        <div className="flex items-start gap-4 py-1 opacity-60">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#86868b] mt-1.5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[16px] leading-[1.47] text-[#1d1d1f]">
                    {item.content}
                </p>
                <div className="flex items-center gap-3 mt-2">
                    <p className="text-[13px] text-[#86868b]">
                        {dateLabel}
                    </p>
                    {item.related_commitment_content && (
                        <button
                            onClick={() => navigate(`/commitments/${item.related_commitment_id}`)}
                            className="text-[13px] text-[#007aff] hover:text-[#0051d5] transition-colors opacity-80"
                        >
                            {item.related_commitment_content}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
