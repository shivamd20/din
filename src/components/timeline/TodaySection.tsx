import { useNavigate } from 'react-router-dom';

interface TodayItem {
    id: string;
    type: 'feed_item' | 'suppressed_task';
    content: string;
    priority_score?: number;
    generation_reason?: string;
    suppression_reason?: string;
    related_commitment_id: string | null;
    related_commitment_content: string | null;
    related_task_id: string | null;
}

interface TodaySectionProps {
    items: TodayItem[];
}

export function TodaySection({ items }: TodaySectionProps) {
    // Only show feed items, ignore suppressed
    const feedItems = items.filter(item => item.type === 'feed_item');

    if (feedItems.length === 0) {
        return null;
    }

    return (
        <div className="mb-20">
            <h2 className="text-[17px] font-medium text-[#1d1d1f] mb-8">Today</h2>
            <div className="space-y-3">
                {feedItems.map((item) => (
                    <TodayItemCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
}

function TodayItemCard({ item }: { item: TodayItem }) {
    const navigate = useNavigate();

    return (
        <div className="py-4 px-5 bg-[#f5f5f7] rounded-2xl">
            <p className="text-[16px] leading-[1.47] text-[#1d1d1f]">
                {item.content}
            </p>
            {item.related_commitment_content && (
                <button
                    onClick={() => item.related_commitment_id && navigate(`/commitments/${item.related_commitment_id}`)}
                    className="mt-3 text-[13px] text-[#007aff] hover:text-[#0051d5] transition-colors"
                >
                    {item.related_commitment_content}
                </button>
            )}
        </div>
    );
}
