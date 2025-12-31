import { TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressMetricsProps {
    completionPercentage: number;
    consistencyScore: number;
    momentumScore: number;
    engagementScore: number;
    daysSinceLastProgress: number | null;
    deadlineRiskScore: number | null;
}

export function ProgressMetrics({
    completionPercentage,
    consistencyScore,
    momentumScore,
    engagementScore,
    daysSinceLastProgress,
    deadlineRiskScore,
}: ProgressMetricsProps) {
    const getScoreColor = (score: number) => {
        if (score >= 0.7) return 'bg-green-500';
        if (score >= 0.4) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 0.7) return 'Strong';
        if (score >= 0.4) return 'Moderate';
        return 'Weak';
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Progress Metrics</h3>

            {/* Completion Percentage */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-700">Completion</span>
                    <span className="text-sm font-semibold text-zinc-900">{Math.round(completionPercentage)}%</span>
                </div>
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${completionPercentage}%` }}
                    />
                </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white border border-zinc-200">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-600">Consistency</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full", getScoreColor(consistencyScore))}
                                style={{ width: `${consistencyScore * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-zinc-700">
                            {getScoreLabel(consistencyScore)}
                        </span>
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-600">Momentum</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full", getScoreColor(momentumScore))}
                                style={{ width: `${momentumScore * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-zinc-700">
                            {getScoreLabel(momentumScore)}
                        </span>
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-600">Engagement</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full", getScoreColor(engagementScore))}
                                style={{ width: `${engagementScore * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-zinc-700">
                            {getScoreLabel(engagementScore)}
                        </span>
                    </div>
                </div>

                {deadlineRiskScore !== null && (
                    <div className="p-3 rounded-xl bg-white border border-zinc-200">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-4 h-4 text-zinc-500" />
                            <span className="text-xs text-zinc-600">Deadline Risk</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full", getScoreColor(1 - deadlineRiskScore))}
                                    style={{ width: `${(1 - deadlineRiskScore) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs font-medium text-zinc-700">
                                {getScoreLabel(1 - deadlineRiskScore)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Days Since Last Progress */}
            {daysSinceLastProgress !== null && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <Clock className="w-4 h-4" />
                    <span>
                        {daysSinceLastProgress === 0
                            ? 'Progress today'
                            : daysSinceLastProgress === 1
                            ? 'Last progress: yesterday'
                            : `Last progress: ${daysSinceLastProgress} days ago`}
                    </span>
                </div>
            )}
        </div>
    );
}

