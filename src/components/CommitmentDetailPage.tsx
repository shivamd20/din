import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { ArrowLeft, CheckCircle2, AlertCircle, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreakCard } from './commitments/StreakCard';
import { ProgressMetrics } from './commitments/ProgressMetrics';
import { BlockerSection } from './commitments/BlockerSection';
import { HealthSummary } from './commitments/HealthSummary';
import { CommitmentTimeline } from './commitments/CommitmentTimeline';
import { CadenceTimeline } from './commitments/CadenceTimeline';
import { useCapture } from '@/contexts/CaptureContext';

export default function CommitmentDetailPage() {
    const { commitmentId } = useParams<{ commitmentId: string }>();
    const navigate = useNavigate();
    const { openCapture } = useCapture();

    const { data: commitment, isLoading } = trpc.commitments.getDetail.useQuery(
        { commitmentId: commitmentId! },
        { enabled: !!commitmentId }
    );

    if (isLoading) {
        return (
            <div className="h-full w-full bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">Loading commitment...</p>
                </div>
            </div>
        );
    }

    if (!commitment) {
        return (
            <div className="h-full w-full bg-white flex items-center justify-center">
                <div className="text-center px-8">
                    <p className="text-zinc-900 font-medium">Commitment not found</p>
                    <button
                        onClick={() => navigate('/commitments')}
                        className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                    >
                        Back to commitments
                    </button>
                </div>
            </div>
        );
    }

    const healthStatus = commitment.health_status || 'on_track';
    const statusConfig = {
        on_track: { label: 'On Track', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
        drifting: { label: 'Drifting', icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
        at_risk: { label: 'At Risk', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
        behind: { label: 'Behind', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    };

    const status = statusConfig[healthStatus as keyof typeof statusConfig] || statusConfig.on_track;
    const StatusIcon = status.icon;

    const handleNextStep = () => {
        if (commitment.next_step) {
            openCapture(commitment.next_step, {
                linked_commitment_id: commitment.id,
            });
        }
    };

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            <div className="max-w-xl mx-auto px-6 py-6 space-y-6">
                {/* Header with back button */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate('/commitments')}
                        className="p-2 hover:bg-zinc-50 rounded-lg transition-colors"
                        aria-label="Back to commitments"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600" />
                    </button>
                    <h1 className="text-xl font-semibold text-zinc-900">Commitment Details</h1>
                </div>

                {/* Commitment Header */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold text-zinc-900 mb-2">
                                {commitment.content}
                            </h2>
                            <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                                status.bg,
                                status.border,
                                status.color,
                                "border"
                            )}>
                                <StatusIcon className="w-4 h-4" />
                                <span>{status.label}</span>
                            </div>
                        </div>
                    </div>

                    {/* User Message */}
                    {commitment.user_message && (
                        <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                            <p className="text-sm text-zinc-700 leading-relaxed">
                                {commitment.user_message}
                            </p>
                        </div>
                    )}

                    {/* Identity Hint */}
                    {commitment.identity_hint && (
                        <div className="mt-3 text-xs text-zinc-500 italic">
                            {commitment.identity_hint}
                        </div>
                    )}

                    {/* Next Step Button */}
                    {commitment.next_step && (
                        <button
                            onClick={handleNextStep}
                            className="mt-4 w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm"
                        >
                            {commitment.next_step}
                        </button>
                    )}
                </div>

                {/* Streak Card */}
                <StreakCard
                    streakCount={commitment.streak_count || 0}
                    longestStreak={commitment.longest_streak || 0}
                    streakMessage={commitment.user_message || ''}
                />

                {/* Progress Metrics */}
                <ProgressMetrics
                    completionPercentage={commitment.completion_percentage || 0}
                    consistencyScore={commitment.consistency_score || 0}
                    momentumScore={commitment.momentum_score || 0}
                    engagementScore={commitment.engagement_score || 0}
                    daysSinceLastProgress={commitment.days_since_last_progress || null}
                    deadlineRiskScore={commitment.deadline_risk_score || null}
                />

                {/* Cadence Timeline */}
                <CadenceTimeline 
                    commitmentId={commitment.id} 
                    commitment={{
                        time_horizon_type: commitment.time_horizon_type,
                        time_horizon_value: commitment.time_horizon_value,
                        cadence_days: commitment.cadence_days,
                        created_at: commitment.created_at,
                        expires_at: commitment.expires_at,
                        streak_count: commitment.streak_count,
                    }}
                />

                {/* Task Timeline */}
                <CommitmentTimeline commitmentId={commitment.id} />

                {/* Blocker Section */}
                <BlockerSection
                    detectedBlockers={
                        commitment.detected_blockers 
                            ? (() => {
                                try {
                                    return typeof commitment.detected_blockers === 'string' 
                                        ? JSON.parse(commitment.detected_blockers) 
                                        : commitment.detected_blockers;
                                } catch {
                                    return [];
                                }
                            })()
                            : []
                    }
                    commitmentId={commitment.id}
                />

                {/* Health Summary */}
                <HealthSummary
                    consistency={commitment.consistency_score || 0}
                    momentum={commitment.momentum_score || 0}
                    deadlineRisk={commitment.deadline_risk_score || null}
                    engagement={commitment.engagement_score || 0}
                />
            </div>
        </div>
    );
}

