import { v4 as uuidv4 } from 'uuid';
import { CommitmentDAO, type CreateCommitmentParams, type GetCommitmentsOptions } from '../db/daos/CommitmentDAO';
import type { Commitment } from '../db/daos/CommitmentDAO';

/**
 * Service layer for Commitment business logic
 */
export class CommitmentService {
    constructor(private commitmentDAO: CommitmentDAO) {}

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
     * Update commitment status by creating a new version
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
            lastAcknowledgedAt: newStatus === 'acknowledged' || newStatus === 'active' ? now : currentCommitment.last_acknowledged_at,
            progressScore: updateProgress ? Math.min(1.0, currentCommitment.progress_score + 0.1) : currentCommitment.progress_score,
            sourceType: currentCommitment.source_type,
            version: newVersion,
            triggerCaptureId: currentCommitment.trigger_capture_id,
            sourceWindowDays: currentCommitment.source_window_days,
            llmRunId: currentCommitment.llm_run_id,
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
}

