import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthSummaryProps {
    consistency: number;
    momentum: number;
    deadlineRisk: number | null;
    engagement: number;
}

export function HealthSummary({ consistency, momentum, deadlineRisk, engagement }: HealthSummaryProps) {
    const getGrade = (score: number) => {
        if (score >= 0.8) return { letter: 'A', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
        if (score >= 0.6) return { letter: 'B', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
        if (score >= 0.4) return { letter: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
        if (score >= 0.2) return { letter: 'D', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
        return { letter: 'F', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    };

    const getComment = (metric: string, score: number) => {
        if (score >= 0.8) return `Strong ${metric}`;
        if (score >= 0.6) return `Good ${metric}`;
        if (score >= 0.4) return `Moderate ${metric}`;
        if (score >= 0.2) return `Weak ${metric}`;
        return `Poor ${metric}`;
    };

    const getIcon = (score: number) => {
        if (score >= 0.6) return CheckCircle2;
        if (score >= 0.4) return AlertCircle;
        return XCircle;
    };

    const metrics = [
        { name: 'Consistency', score: consistency },
        { name: 'Momentum', score: momentum },
        { name: 'Engagement', score: engagement },
        ...(deadlineRisk !== null ? [{ name: 'Deadline Risk', score: 1 - deadlineRisk }] : []),
    ];

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Health Summary</h3>
            <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => {
                    const grade = getGrade(metric.score);
                    const Icon = getIcon(metric.score);
                    return (
                        <div
                            key={metric.name}
                            className={cn(
                                "p-4 rounded-xl border",
                                grade.bg,
                                grade.border
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-zinc-700">{metric.name}</span>
                                <Icon className={cn("w-4 h-4", grade.color)} />
                            </div>
                            <div className={cn("text-2xl font-bold mb-1", grade.color)}>
                                {grade.letter}
                            </div>
                            <p className="text-xs text-zinc-600">
                                {getComment(metric.name.toLowerCase(), metric.score)}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

