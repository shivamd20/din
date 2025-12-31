import { Flame } from 'lucide-react';

interface StreakSummary {
    commitment_id: string | null;
    commitment_content: string | null;
    current_streak: number;
    longest_streak: number;
    type: 'per_commitment' | 'aggregate' | 'identity_pattern';
    description: string;
}

interface InsightsSectionProps {
    streaks: StreakSummary[];
}

export function InsightsSection({ streaks }: InsightsSectionProps) {
    if (streaks.length === 0) {
        return null;
    }

    // Show only the first (most relevant) streak
    const streak = streaks[0];

    return (
        <div className="mb-20">
            <div className="py-5 px-6 bg-gradient-to-br from-[#fff5e6] to-[#fff9f0] rounded-2xl border border-[#ffd60a]/20">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#ff9500]/10 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-[#ff9500]" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[20px] font-semibold text-[#1d1d1f] mb-1">
                            {streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}
                        </p>
                        <p className="text-[15px] leading-[1.47] text-[#86868b]">
                            {streak.description}
                        </p>
                        {streak.commitment_content && (
                            <p className="text-[13px] text-[#86868b] mt-2 italic">
                                "{streak.commitment_content}"
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
