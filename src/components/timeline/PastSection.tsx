import { format, isToday, isYesterday } from 'date-fns';
import { CheckCircle2, Circle, Play, Clock, X, FileText, Zap, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface TimelineTaskItem {
    id: string;
    item_type: 'task';
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

interface TimelineEntryItem {
    id: string;
    item_type: 'entry';
    content: string;
    created_at: number;
    action_type: string | null;
    action_context: Record<string, unknown> | null;
    feed_item_id: string | null;
    event_type: string | null;
    linked_task_id: string | null;
    linked_commitment_id: string | null;
    commitment_content: string | null;
    action_title?: string;
    card_content?: string;
    generation_reason?: string;
}

type TimelineItem = TimelineTaskItem | TimelineEntryItem;

interface PastSectionProps {
    items: TimelineItem[];
}

export function PastSection({ items }: PastSectionProps) {
    if (items.length === 0) {
        return null;
    }

    // Group by date
    const groupedByDate = items.reduce((acc, item) => {
        const date = item.item_type === 'task' 
            ? (item.completed_at || item.created_at)
            : item.created_at;
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
    if (item.item_type === 'task') {
        return <TaskItem item={item} />;
    } else {
        return <EntryItem item={item} />;
    }
}

function TaskItem({ item }: { item: TimelineTaskItem }) {
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

function ActionBadge({ actionType, eventType }: { actionType: string | null; eventType: string | null }) {
    const action = actionType || eventType;
    if (!action) return null;

    let icon;
    let label;
    let colorClass;

    // Map action types to icons and colors
    if (action === 'done' || action === 'task_finish') {
        icon = <CheckCircle2 className="w-3.5 h-3.5" />;
        label = 'Done';
        colorClass = 'bg-green-50 text-green-700 border-green-200';
    } else if (action === 'start' || action === 'task_start') {
        icon = <Play className="w-3.5 h-3.5" />;
        label = 'Started';
        colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (action === 'snooze' || action === 'task_snooze') {
        icon = <Clock className="w-3.5 h-3.5" />;
        label = 'Snoozed';
        colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (action === 'skip' || action === 'task_skip') {
        icon = <X className="w-3.5 h-3.5" />;
        label = 'Skipped';
        colorClass = 'bg-red-50 text-red-700 border-red-200';
    } else {
        icon = <FileText className="w-3.5 h-3.5" />;
        label = action;
        colorClass = 'bg-zinc-50 text-zinc-700 border-zinc-200';
    }

    return (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${colorClass}`}>
            {icon}
            {label}
        </span>
    );
}

function EntryItem({ item }: { item: TimelineEntryItem }) {
    const navigate = useNavigate();
    const [showMetadata, setShowMetadata] = useState(false);
    const date = new Date(item.created_at);
    const timeLabel = format(date, 'h:mm a');
    
    const hasAction = !!(item.action_type || item.event_type);
    const hasMetadata = !!(item.feed_item_id || item.action_context || item.linked_task_id || item.linked_commitment_id);

    return (
        <div className="flex items-start gap-4 py-1">
            <div className="mt-0.5 flex-shrink-0">
                {hasAction ? (
                    <div className="w-5 h-5 flex items-center justify-center">
                        {item.action_type === 'done' || item.event_type === 'task_finish' ? (
                            <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                        ) : item.action_type === 'start' || item.event_type === 'task_start' ? (
                            <Play className="w-5 h-5 text-[#007aff]" />
                        ) : item.action_type === 'snooze' || item.event_type === 'task_snooze' ? (
                            <Clock className="w-5 h-5 text-[#ff9500]" />
                        ) : item.action_type === 'skip' || item.event_type === 'task_skip' ? (
                            <X className="w-5 h-5 text-[#ff3b30]" />
                        ) : (
                            <FileText className="w-5 h-5 text-[#86868b]" />
                        )}
                    </div>
                ) : (
                    <FileText className="w-5 h-5 text-[#86868b]" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                {/* Action title or content */}
                {hasAction && item.action_title ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[16px] leading-[1.47] text-[#1d1d1f] font-medium">
                                {item.action_title}
                            </p>
                            <ActionBadge actionType={item.action_type} eventType={item.event_type} />
                            {item.feed_item_id && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    From Feed
                                </span>
                            )}
                        </div>
                        {item.card_content && (
                            <p className="text-[15px] leading-[1.47] text-[#86868b] italic">
                                "{item.card_content}"
                            </p>
                        )}
                        {item.content && (
                            <p className="text-[15px] leading-[1.47] text-[#1d1d1f]">
                                {item.content}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-[16px] leading-[1.47] text-[#1d1d1f]">
                        {item.content}
                    </p>
                )}
                
                {/* Time and links */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className="text-[13px] text-[#86868b]">
                        {timeLabel}
                    </p>
                    {item.commitment_content && (
                        <button
                            onClick={() => item.linked_commitment_id && navigate(`/commitments/${item.linked_commitment_id}`)}
                            className="text-[13px] text-[#007aff] hover:text-[#0051d5] transition-colors"
                        >
                            {item.commitment_content}
                        </button>
                    )}
                    {item.generation_reason && (
                        <span className="text-[11px] text-[#86868b] italic">
                            {item.generation_reason}
                        </span>
                    )}
                </div>

                {/* Expandable metadata */}
                {hasMetadata && (
                    <div className="mt-3">
                        <button
                            onClick={() => setShowMetadata(!showMetadata)}
                            className="flex items-center gap-1 text-[11px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                        >
                            {showMetadata ? (
                                <>
                                    <ChevronUp className="w-3 h-3" />
                                    Hide details
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3 h-3" />
                                    Show details
                                </>
                            )}
                        </button>
                        
                        {showMetadata && (
                            <div className="mt-2 p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5e7] space-y-2 animate-in fade-in slide-in-from-top-2">
                                {item.feed_item_id && (
                                    <div className="text-[11px] text-[#86868b]">
                                        <span className="font-medium">Feed Item ID:</span>{' '}
                                        <code className="text-[10px] bg-white px-1.5 py-0.5 rounded">{item.feed_item_id}</code>
                                    </div>
                                )}
                                
                                {(item.linked_task_id || item.linked_commitment_id) && (
                                    <div className="flex items-center gap-2 text-[11px] text-[#86868b]">
                                        <Link2 className="w-3 h-3 text-[#86868b]" />
                                        {item.linked_task_id && (
                                            <span>Task: <code className="text-[10px] bg-white px-1.5 py-0.5 rounded">{item.linked_task_id}</code></span>
                                        )}
                                        {item.linked_task_id && item.linked_commitment_id && <span>•</span>}
                                        {item.linked_commitment_id && (
                                            <span>Commitment: <code className="text-[10px] bg-white px-1.5 py-0.5 rounded">{item.linked_commitment_id}</code></span>
                                        )}
                                    </div>
                                )}
                                
                                {item.action_context && (
                                    <div className="text-[11px] text-[#86868b]">
                                        <div className="font-medium mb-1">Action Context:</div>
                                        <pre className="text-[10px] bg-white p-2 rounded overflow-x-auto max-h-48">
                                            {JSON.stringify(item.action_context, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
