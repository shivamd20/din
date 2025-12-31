import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakCardProps {
    streakCount: number;
    longestStreak: number;
    streakMessage: string;
}

export function StreakCard({ streakCount, longestStreak, streakMessage }: StreakCardProps) {
    return (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/50 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                    <Flame className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-zinc-700">Current Streak</h3>
                    <p className="text-2xl font-bold text-orange-700">{streakCount} days</p>
                </div>
            </div>

            {longestStreak > 0 && longestStreak !== streakCount && (
                <div className="text-xs text-zinc-600 mb-3">
                    Longest streak: <span className="font-semibold">{longestStreak} days</span>
                </div>
            )}

            {streakMessage && (
                <div className="mt-3 p-3 bg-white/60 rounded-lg border border-orange-200/50">
                    <p className="text-sm text-zinc-700 leading-relaxed">{streakMessage}</p>
                </div>
            )}

            {/* Visual streak indicator - chain of days */}
            <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: Math.min(streakCount, 30) }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-2 h-2 rounded-full",
                            i < streakCount ? "bg-orange-500" : "bg-zinc-200"
                        )}
                    />
                ))}
                {streakCount > 30 && (
                    <span className="text-xs text-zinc-500 ml-1">+{streakCount - 30}</span>
                )}
            </div>
        </div>
    );
}

