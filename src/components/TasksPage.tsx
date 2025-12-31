import { trpc } from '../lib/trpc';
import { PastSection } from './timeline/PastSection';
import { TodaySection } from './timeline/TodaySection';
import { FutureSection } from './timeline/FutureSection';
import { InsightsSection } from './timeline/InsightsSection';
import { Clock } from 'lucide-react';

export default function TasksPage() {
    const { data: timelineData, isFetching } = trpc.tasks.timeline.useQuery({});

    // Show loading state
    if (isFetching && !timelineData) {
        return (
            <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#e5e5e7] border-t-[#1d1d1f] rounded-full animate-spin mb-3" />
                <p className="text-[15px] text-[#86868b]">Loading...</p>
            </div>
        );
    }

    // Show empty state
    if (!timelineData || (
        timelineData.past.length === 0 &&
        timelineData.today.length === 0 &&
        timelineData.future.length === 0
    )) {
        return (
            <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32 flex flex-col items-center justify-center text-center px-8">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-6">
                    <Clock className="w-7 h-7 text-[#86868b]" />
                </div>
                <p className="text-[20px] font-semibold text-[#1d1d1f] mb-2">Your Timeline</p>
                <p className="text-[15px] leading-[1.47] text-[#86868b] max-w-xs">
                    Your timeline will appear here as you complete tasks and build commitments.
                </p>
            </div>
        );
    }

    const hasStreaks = timelineData.insights.streaks.length > 0;

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            <div className="max-w-2xl mx-auto px-5 py-10">
                {/* Insights - Only streaks, at top */}
                {hasStreaks && (
                    <InsightsSection streaks={timelineData.insights.streaks} />
                )}

                {/* Past Section */}
                <PastSection items={timelineData.past} />

                {/* Today Section */}
                <TodaySection items={timelineData.today} />

                {/* Future Section */}
                <FutureSection items={timelineData.future} />
            </div>
        </div>
    );
}
