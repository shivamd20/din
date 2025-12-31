import { v4 as uuidv4 } from 'uuid';
import { EntryDAO, type CreateEntryParams } from '../db/daos/EntryDAO';

export interface AddEntryOptions {
    id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attachments?: any[];
    rootId?: string;
    parentId?: string;
    linkedTaskId?: string;
    linkedCommitmentId?: string;
    eventType?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
    location?: string;
    mood?: string;
    energyLevel?: number;
    feedItemId?: string | null;
    actionType?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionContext?: any;
}

/**
 * Service layer for Entry business logic
 */
export class EntryService {
    constructor(private entryDAO: EntryDAO) {}

    /**
     * Add a new entry with idempotency check
     */
    addEntry(
        userId: string,
        text: string,
        source: string,
        opts?: AddEntryOptions
    ): string {
        const entryId = opts?.id || uuidv4();
        const createdAt = Date.now();
        const attachmentsJson = opts?.attachments ? JSON.stringify(opts.attachments) : null;
        const rootId = opts?.rootId || null;
        const parentId = opts?.parentId || null;
        const linkedTaskId = opts?.linkedTaskId || null;
        const linkedCommitmentId = opts?.linkedCommitmentId || null;
        const eventType = opts?.eventType || null;
        const payloadJson = opts?.payload ? JSON.stringify(opts.payload) : null;
        const location = opts?.location || null;
        const mood = opts?.mood || null;
        const energyLevel = opts?.energyLevel || null;
        const feedItemId = opts?.feedItemId || null;
        const actionType = opts?.actionType || null;
        const actionContext = opts?.actionContext ? JSON.stringify(opts.actionContext) : null;

        // Check if entry exists (idempotency)
        if (!this.entryDAO.exists(entryId)) {
            const params: CreateEntryParams = {
                id: entryId,
                userId,
                text,
                createdAt,
                source,
                attachmentsJson,
                rootId,
                parentId,
                linkedTaskId,
                linkedCommitmentId,
                eventType,
                payloadJson,
                location,
                mood,
                energyLevel,
                feedItemId,
                actionType,
                actionContext,
            };
            this.entryDAO.create(params);
        }

        return entryId;
    }

    /**
     * Get captures for a time window
     */
    getCapturesForWindow(userId: string, windowDays: number): Array<{ id: string; text: string; created_at: number }> {
        const cutoffTime = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
        return this.entryDAO.getByUserTimeWindow(userId, cutoffTime);
    }

    /**
     * Get home page data with scoring
     */
    getHome(userId: string) {
        const entries = this.entryDAO.getForHome(userId);

        const cards = entries.map(entry => {
            const ageHours = (Date.now() - entry.created_at) / (1000 * 60 * 60);
            const recency = Math.max(0, 1 - (ageHours / 24));
            const score = recency;

            return {
                id: entry.id,
                type: 'entry',
                text: entry.text,
                score,
                actions: []
            };
        }).filter(c => c.score >= 0.45)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return {
            cards,
            state_snapshot: []
        };
    }

    /**
     * Get recent entries
     */
    getRecentEntries(limit: number = 20) {
        return this.entryDAO.getRecent(limit);
    }

    /**
     * Get all entries for a user (ordered by created_at ASC)
     */
    getAllEntries(userId: string) {
        return this.entryDAO.getAllByUser(userId);
    }
}


