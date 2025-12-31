import React from 'react';
import { Target, CheckCircle2, AlertCircle, TrendingDown, AlertTriangle, Flame, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Commitment {
    id: string;
    content: string;
    status: string;
    health_status: string | null;
    streak_count: number | null;
    longest_streak: number | null;
    completion_percentage: number | null;
    detected_blockers: string | null;
    next_step: string | null;
    user_message: string | null;
    expires_at: number | null;
    [key: string]: unknown;
}

interface CommitmentCardProps {
    commitment: Commitment;
}

const healthStatusConfig = {
    on_track: { label: 'On Track', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    drifting: { label: 'Drifting', icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    at_risk: { label: 'At Risk', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    behind: { label: 'Behind', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

const statusConfig = {
    confirmed: { label: 'Confirmed', color: 'text-blue-600', bg: 'bg-blue-50' },
    active: { label: 'Active', color: 'text-green-600', bg: 'bg-green-50' },
    completed: { label: 'Completed', color: 'text-gray-600', bg: 'bg-gray-50' },
    retired: { label: 'Retired', color: 'text-red-600', bg: 'bg-red-50' },
    renegotiated: { label: 'Renegotiated', color: 'text-purple-600', bg: 'bg-purple-50' },
};

export function CommitmentCard({ commitment }: CommitmentCardProps) {
    const healthStatus = commitment.health_status 
        ? healthStatusConfig[commitment.health_status as keyof typeof healthStatusConfig]
        : null;
    const HealthIcon = healthStatus?.icon || Target;

    const status = statusConfig[commitment.status as keyof typeof statusConfig] || statusConfig.active;

    // Parse blockers if present
    let blockers: string[] = [];
    if (commitment.detected_blockers) {
        try {
            blockers = typeof commitment.detected_blockers === 'string'
                ? JSON.parse(commitment.detected_blockers)
                : commitment.detected_blockers;
        } catch {
            // Invalid JSON, ignore
        }
    }

    const expiresAt = commitment.expires_at ? new Date(commitment.expires_at) : null;
    const formattedExpiry = expiresAt?.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm ring-1 ring-purple-100/50 shrink-0">
                    <Target className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-zinc-900 leading-relaxed mb-2">
                        {commitment.content}
                    </p>
                </div>
            </div>

            <div className="space-y-3 mt-3 pt-3 border-t border-zinc-100">
                {/* Status and Health */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        status.bg,
                        status.color
                    )}>
                        {status.label}
                    </div>

                    {healthStatus && (
                        <div className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border",
                            healthStatus.bg,
                            healthStatus.color,
                            healthStatus.border
                        )}>
                            <HealthIcon className="w-3 h-3" />
                            <span>{healthStatus.label}</span>
                        </div>
                    )}
                </div>

                {/* Metrics */}
                {(commitment.streak_count !== null || commitment.completion_percentage !== null) && (
                    <div className="flex items-center gap-4 text-xs text-zinc-600">
                        {commitment.streak_count !== null && commitment.streak_count > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-orange-500" />
                                <span>{commitment.streak_count} day streak</span>
                            </div>
                        )}
                        {commitment.completion_percentage !== null && (
                            <div className="flex items-center gap-1.5">
                                <span>{Math.round(commitment.completion_percentage)}% complete</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Blockers */}
                {blockers.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-zinc-500">Blockers:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {blockers.map((blocker, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs border border-red-200"
                                >
                                    {blocker}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Next Step */}
                {commitment.next_step && (
                    <div className="pt-2 border-t border-zinc-100">
                        <p className="text-xs font-medium text-zinc-500 mb-1">Next Step:</p>
                        <p className="text-sm text-zinc-700">{commitment.next_step}</p>
                    </div>
                )}

                {/* User Message */}
                {commitment.user_message && (
                    <div className="pt-2 border-t border-zinc-100">
                        <p className="text-xs font-medium text-zinc-500 mb-1">Message:</p>
                        <p className="text-sm text-zinc-700 italic">{commitment.user_message}</p>
                    </div>
                )}

                {/* Expiry */}
                {formattedExpiry && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Expires: {formattedExpiry}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

