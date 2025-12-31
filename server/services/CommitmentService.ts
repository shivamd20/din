import { v4 as uuidv4 } from 'uuid';
import { CommitmentDAO, type CreateCommitmentParams, type GetCommitmentsOptions } from '../db/daos/CommitmentDAO';
import type { Commitment } from '../db/daos/CommitmentDAO';
import type { AIService } from '../ai-service';

/**
 * Service layer for Commitment business logic
 */
export class CommitmentService {
    constructor(
        private commitmentDAO: CommitmentDAO,
        private aiService?: AIService
    ) {}

    /**
     * Add a single commitment
     */
    addCommitment(
        userId: string,
        originEntryId: string,
        content: string,
        strength: string,
        horizon: string,
        triggerCaptureId: string | null,
        sourceWindowDays: number | null,
        llmRunId: string | null,
        status: string = 'active',
        sourceType: string = 'ai'
    ): string {
        const maxVersion = this.commitmentDAO.getMaxVersion(userId, originEntryId);
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        const params: CreateCommitmentParams = {
            id,
            userId,
            originEntryId,
            content,
            strength,
            horizon,
            status,
            createdAt: now,
            expiresAt: null,
            lastAcknowledgedAt: null,
            progressScore: 0.0,
            sourceType,
            version: newVersion,
            triggerCaptureId,
            sourceWindowDays,
            llmRunId,
            confirmedAt: null,
            timeHorizonType: null,
            timeHorizonValue: null,
            cadenceDays: null,
            checkInMethod: null,
        };

        this.commitmentDAO.create(params);
        return id;
    }

    /**
     * Add multiple commitments in batch
     */
    addCommitmentsBatch(
        userId: string,
        commitments: Array<{
            origin_entry_id: string;
            strength: string;
            horizon: string;
            content: string;
            status?: string;
        }>,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): string[] {
        const ids: string[] = [];
        for (const commitment of commitments) {
            const id = this.addCommitment(
                userId,
                commitment.origin_entry_id,
                commitment.content,
                commitment.strength,
                commitment.horizon,
                triggerCaptureId,
                sourceWindowDays,
                llmRunId,
                commitment.status || 'active'
            );
            ids.push(id);
        }
        return ids;
    }

    /**
     * Get commitments with options
     */
    getCommitments(userId: string, options: GetCommitmentsOptions = {}): Commitment[] {
        return this.commitmentDAO.get(userId, options);
    }

    /**
     * Confirm a potential commitment from feed item
     * Creates an active commitment with structured time horizon fields
     */
    async confirmCommitment(
        userId: string,
        originEntryId: string,
        confirmationText: string,
        feedItemMetadata?: Record<string, unknown>
    ): Promise<string> {
        // Parse commitment details from text using LLM
        let commitmentDetails;
        if (this.aiService) {
            commitmentDetails = await this.aiService.parseCommitmentDetails(confirmationText, feedItemMetadata);
        } else {
            // Fallback to basic parsing
            const { parseTimeHorizonFromText } = await import('../time-horizon-parser');
            const timeHorizon = parseTimeHorizonFromText(confirmationText);
            commitmentDetails = {
                content: confirmationText,
                strength: (feedItemMetadata?.detected_strength as "weak" | "medium" | "strong") || "medium",
                horizon: (feedItemMetadata?.detected_horizon as "short" | "medium" | "long") || "medium",
                time_horizon_type: timeHorizon.time_horizon_type,
                time_horizon_value: timeHorizon.time_horizon_value,
                cadence_days: timeHorizon.cadence_days,
                check_in_method: (feedItemMetadata?.check_in_method as "review" | "metric" | "reminder" | "task_completion") || null,
                consequence_level: (feedItemMetadata?.consequence_level as "soft" | "medium" | "hard") || undefined
            };
        }

        const maxVersion = this.commitmentDAO.getMaxVersion(userId, originEntryId);
        const newVersion = maxVersion + 1;
        const now = Date.now();

        // Set expires_at if time_horizon_type is "date"
        const expiresAt = commitmentDetails.time_horizon_type === "date" && commitmentDetails.time_horizon_value
            ? commitmentDetails.time_horizon_value
            : null;

        const id = uuidv4();
        const params: CreateCommitmentParams = {
            id,
            userId,
            originEntryId,
            content: commitmentDetails.content,
            strength: commitmentDetails.strength,
            horizon: commitmentDetails.horizon,
            status: "active", // confirmed = active immediately
            createdAt: now,
            expiresAt,
            lastAcknowledgedAt: now,
            progressScore: 0.0,
            sourceType: "user",
            version: newVersion,
            triggerCaptureId: null,
            sourceWindowDays: null,
            llmRunId: null,
            confirmedAt: now,
            timeHorizonType: commitmentDetails.time_horizon_type,
            timeHorizonValue: commitmentDetails.time_horizon_value,
            cadenceDays: commitmentDetails.cadence_days,
            checkInMethod: commitmentDetails.check_in_method,
        };

        this.commitmentDAO.create(params);
        return id;
    }

    /**
     * Update commitment status by creating a new version
     * Validates state transitions
     */
    updateCommitmentStatus(
        userId: string,
        commitmentId: string,
        newStatus: string,
        captureId: string,
        updateProgress?: boolean
    ): void {
        // Get current commitment
        const commitments = this.commitmentDAO.get(userId, {});
        const currentCommitment = commitments.find(c => c.id === commitmentId);
        if (!currentCommitment) {
            throw new Error(`Commitment ${commitmentId} not found`);
        }

        // Validate state transitions
        const validTransitions: Record<string, string[]> = {
            "confirmed": ["active", "retired"],
            "active": ["completed", "retired", "active"], // active can transition to active (renegotiation)
            "completed": [], // Terminal state
            "retired": [], // Terminal state
            "renegotiated": ["active"] // Legacy: renegotiated can become active (shouldn't happen with new flow)
        };

        const allowedStatuses = validTransitions[currentCommitment.status] || [];
        if (newStatus !== currentCommitment.status && !allowedStatuses.includes(newStatus)) {
            throw new Error(`Invalid state transition from ${currentCommitment.status} to ${newStatus}`);
        }

        // Create new version with updated status
        const maxVersion = this.commitmentDAO.getMaxVersion(userId, currentCommitment.origin_entry_id);
        const newVersion = maxVersion + 1;
        const now = Date.now();

        const params: CreateCommitmentParams = {
            id: crypto.randomUUID(), // New ID for new version
            userId,
            originEntryId: currentCommitment.origin_entry_id,
            content: currentCommitment.content,
            strength: currentCommitment.strength,
            horizon: currentCommitment.horizon,
            status: newStatus,
            createdAt: now,
            expiresAt: currentCommitment.expires_at,
            lastAcknowledgedAt: newStatus === 'active' || newStatus === 'confirmed' ? now : currentCommitment.last_acknowledged_at,
            progressScore: updateProgress ? Math.min(1.0, currentCommitment.progress_score + 0.1) : currentCommitment.progress_score,
            sourceType: currentCommitment.source_type,
            version: newVersion,
            triggerCaptureId: currentCommitment.trigger_capture_id,
            sourceWindowDays: currentCommitment.source_window_days,
            llmRunId: currentCommitment.llm_run_id,
            confirmedAt: currentCommitment.confirmed_at,
            timeHorizonType: currentCommitment.time_horizon_type,
            timeHorizonValue: currentCommitment.time_horizon_value,
            cadenceDays: currentCommitment.cadence_days,
            checkInMethod: currentCommitment.check_in_method,
        };

        this.commitmentDAO.create(params);
    }

    /**
     * Get commitment by ID
     */
    getCommitmentById(userId: string, commitmentId: string): Commitment | undefined {
        const commitments = this.commitmentDAO.get(userId, {});
        return commitments.find(c => c.id === commitmentId);
    }

    /**
     * Update commitment metrics (does not create new version)
     * Called after feed generation to update LLM-computed metrics
     */
    updateCommitmentMetrics(
        userId: string,
        commitmentId: string,
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
            detected_blockers: string[] | null;
            identity_hint: string | null;
        }
    ): void {
        // Serialize detected_blockers array to JSON string
        const blockersJson = metrics.detected_blockers 
            ? JSON.stringify(metrics.detected_blockers)
            : null;

        this.commitmentDAO.updateMetrics(
            commitmentId,
            userId,
            {
                health_status: metrics.health_status,
                streak_count: metrics.streak_count,
                longest_streak: metrics.longest_streak,
                completion_percentage: metrics.completion_percentage,
                days_since_last_progress: metrics.days_since_last_progress,
                deadline_risk_score: metrics.deadline_risk_score,
                consistency_score: metrics.consistency_score,
                momentum_score: metrics.momentum_score,
                engagement_score: metrics.engagement_score,
                user_message: metrics.user_message,
                next_step: metrics.next_step,
                detected_blockers: blockersJson,
                identity_hint: metrics.identity_hint,
                last_analyzed_at: Date.now()
            }
        );
    }
}

