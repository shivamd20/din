import { ENTRY_QUERIES } from "../queries";

export interface Entry {
    id: string;
    user_id: string;
    text: string;
    created_at: number;
    source: string;
    attachments_json: string | null;
    root_id: string | null;
    parent_id: string | null;
    linked_task_id: string | null;
    linked_commitment_id: string | null;
    event_type: string | null;
    payload_json: string | null;
    location: string | null;
    mood: string | null;
    energy_level: number | null;
    feed_item_id: string | null;
    action_type: string | null;
    action_context: string | null;
    [key: string]: SqlStorageValue;
}

export interface CreateEntryParams {
    id: string;
    userId: string;
    text: string;
    createdAt: number;
    source: string;
    attachmentsJson: string | null;
    rootId: string | null;
    parentId: string | null;
    linkedTaskId: string | null;
    linkedCommitmentId: string | null;
    eventType: string | null;
    payloadJson: string | null;
    location: string | null;
    mood: string | null;
    energyLevel: number | null;
    feedItemId: string | null;
    actionType: string | null;
    actionContext: string | null;
}

/**
 * Data Access Object for Entries (Captures)
 */
export class EntryDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Check if an entry exists by ID
     */
    exists(id: string): boolean {
        const result = this.sql.exec(ENTRY_QUERIES.CHECK_EXISTS, id).one() as { c: number };
        return result.c > 0;
    }

    /**
     * Create a new entry
     */
    create(params: CreateEntryParams): void {
        this.sql.exec(
            ENTRY_QUERIES.INSERT,
            params.id,
            params.userId,
            params.text,
            params.createdAt,
            params.source,
            params.attachmentsJson,
            params.rootId,
            params.parentId,
            params.linkedTaskId,
            params.linkedCommitmentId,
            params.eventType,
            params.payloadJson,
            params.location,
            params.mood,
            params.energyLevel,
            params.feedItemId,
            params.actionType,
            params.actionContext
        );
    }

    /**
     * Get entries for a user within a time window
     */
    getByUserTimeWindow(userId: string, cutoffTime: number): Array<{ id: string; text: string; created_at: number }> {
        const entries = this.sql.exec<Entry>(
            ENTRY_QUERIES.GET_BY_USER_TIME_WINDOW,
            userId,
            cutoffTime
        ).toArray();

        return entries.map(e => ({
            id: e.id,
            text: e.text,
            created_at: e.created_at
        }));
    }

    /**
     * Get entries for home page
     */
    getForHome(userId: string): Entry[] {
        return this.sql.exec<Entry>(ENTRY_QUERIES.GET_HOME, userId).toArray();
    }

    /**
     * Get recent entries
     */
    getRecent(limit: number): Entry[] {
        return this.sql.exec<Entry>(ENTRY_QUERIES.GET_RECENT, limit).toArray();
    }

    /**
     * Get entry by ID
     */
    getById(id: string): Entry | null {
        const result = this.sql.exec<Entry>(ENTRY_QUERIES.GET_BY_ID, id).one();
        return result || null;
    }

    /**
     * Get all entries for a user (ordered by created_at ASC)
     */
    getAllByUser(userId: string): Entry[] {
        return this.sql.exec<Entry>(ENTRY_QUERIES.GET_ALL_BY_USER, userId).toArray();
    }
}

