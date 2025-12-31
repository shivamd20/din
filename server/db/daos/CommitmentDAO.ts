import { COMMITMENT_QUERIES } from "../queries";

export interface Commitment {
    id: string;
    user_id: string;
    origin_entry_id: string;
    content: string;
    strength: string; // weak | medium | strong
    horizon: string; // short | medium | long (legacy field, kept for compatibility)
    status: string; // confirmed | active | completed | retired | renegotiated
    created_at: number;
    expires_at: number | null;
    last_acknowledged_at: number | null;
    progress_score: number; // 0-1
    source_type: string; // ai | user
    version: number;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    llm_run_id: string | null;
    confirmed_at: number | null;
    time_horizon_type: string | null; // date | daily | weekly | monthly | continuous | maintain
    time_horizon_value: number | null; // timestamp if type="date"
    cadence_days: number | null; // recurring interval in days (e.g., 7 for weekly)
    check_in_method: string | null; // review | metric | reminder | task_completion
    // Metrics fields (added for commitment dashboard)
    health_status: string | null; // 'on_track' | 'drifting' | 'at_risk' | 'behind'
    streak_count: number | null;
    longest_streak: number | null;
    completion_percentage: number | null;
    days_since_last_progress: number | null;
    deadline_risk_score: number | null;
    consistency_score: number | null;
    momentum_score: number | null;
    engagement_score: number | null;
    user_message: string | null;
    next_step: string | null;
    detected_blockers: string | null; // JSON array stored as text
    identity_hint: string | null;
    last_analyzed_at: number | null;
}

export interface CreateCommitmentParams {
    id: string;
    userId: string;
    originEntryId: string;
    content: string;
    strength: string;
    horizon: string;
    status: string;
    createdAt: number;
    expiresAt: number | null;
    lastAcknowledgedAt: number | null;
    progressScore: number;
    sourceType: string;
    version: number;
    triggerCaptureId: string | null;
    sourceWindowDays: number | null;
    llmRunId: string | null;
    confirmedAt: number | null;
    timeHorizonType: string | null;
    timeHorizonValue: number | null;
    cadenceDays: number | null;
    checkInMethod: string | null;
}

export interface GetCommitmentsOptions {
    status?: string;
    include_history?: boolean;
    trigger_capture_id?: string;
}

/**
 * Data Access Object for Commitments
 */
export class CommitmentDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Get the maximum version for a commitment
     */
    getMaxVersion(userId: string, originEntryId: string): number {
        const result = this.sql.exec(
            COMMITMENT_QUERIES.GET_MAX_VERSION,
            userId,
            originEntryId
        ).one() as { max_version: number | null };
        return result.max_version || 0;
    }

    /**
     * Create a new commitment
     */
    create(params: CreateCommitmentParams): void {
        this.sql.exec(
            COMMITMENT_QUERIES.INSERT,
            params.id,
            params.userId,
            params.originEntryId,
            params.content,
            params.strength,
            params.horizon,
            params.createdAt,
            params.expiresAt,
            params.lastAcknowledgedAt,
            params.version,
            params.triggerCaptureId,
            params.sourceWindowDays,
            params.status,
            params.llmRunId,
            params.sourceType,
            params.progressScore,
            params.confirmedAt,
            params.timeHorizonType,
            params.timeHorizonValue,
            params.cadenceDays,
            params.checkInMethod
        );
    }

    /**
     * Get commitments with optional filtering
     */
    get(userId: string, options: GetCommitmentsOptions = {}): Commitment[] {
        let query = COMMITMENT_QUERIES.GET_BASE;
        const params: (string | number)[] = [userId];

        if (options.status) {
            query += ` AND status = ?`;
            params.push(options.status);
        }

        if (options.trigger_capture_id) {
            query += ` AND trigger_capture_id = ?`;
            params.push(options.trigger_capture_id);
        }

        if (!options.include_history) {
            const subWhereConditions: string[] = ['user_id = ?'];
            const subParams: (string | number)[] = [userId];
            
            if (options.status) {
                subWhereConditions.push('status = ?');
                subParams.push(options.status);
            }
            if (options.trigger_capture_id) {
                subWhereConditions.push('trigger_capture_id = ?');
                subParams.push(options.trigger_capture_id);
            }
            
            query = COMMITMENT_QUERIES.GET_LATEST_VERSION(subWhereConditions);
            
            // Reset params: subParams (for subquery) + userId (for outer WHERE)
            params.length = 0;
            params.push(...subParams);
            params.push(userId);
        }

        query += ` ORDER BY created_at DESC`;

        return this.sql.exec(query, ...params).toArray() as unknown as Commitment[];
    }

    /**
     * Update commitment metrics (does not create new version)
     */
    updateMetrics(
        commitmentId: string,
        userId: string,
        metrics: {
            health_status: string;
            streak_count: number;
            longest_streak: number | null;
            completion_percentage: number;
            days_since_last_progress: number | null;
            deadline_risk_score: number | null;
            consistency_score: number;
            momentum_score: number;
            engagement_score: number;
            user_message: string;
            next_step: string;
            detected_blockers: string | null; // JSON string
            identity_hint: string | null;
            last_analyzed_at: number;
        }
    ): void {
        this.sql.exec(
            COMMITMENT_QUERIES.UPDATE_METRICS,
            metrics.health_status,
            metrics.streak_count,
            metrics.longest_streak,
            metrics.completion_percentage,
            metrics.days_since_last_progress,
            metrics.deadline_risk_score,
            metrics.consistency_score,
            metrics.momentum_score,
            metrics.engagement_score,
            metrics.user_message,
            metrics.next_step,
            metrics.detected_blockers,
            metrics.identity_hint,
            metrics.last_analyzed_at,
            commitmentId,
            userId
        );
    }
}

