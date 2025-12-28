import { FEED_QUERIES } from "../queries";
import type { FeedItemRendered } from "../../UserDO";

export interface FeedSnapshot {
    id: string;
    user_id: string;
    feed_version: number;
    generated_at: number;
    items_json: string;
    [key: string]: SqlStorageValue;
}

/**
 * Data Access Object for Feed Snapshots
 */
export class FeedDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Save a feed snapshot
     */
    save(params: {
        id: string;
        userId: string;
        version: number;
        generatedAt: number;
        itemsJson: string;
    }): void {
        this.sql.exec(
            FEED_QUERIES.INSERT,
            params.id,
            params.userId,
            params.version,
            params.generatedAt,
            params.itemsJson
        );
    }

    /**
     * Get the current feed for a user
     */
    getCurrent(userId: string): FeedItemRendered[] {
        const result = this.sql.exec<FeedSnapshot>(
            FEED_QUERIES.GET_CURRENT,
            userId
        );

        const snapshots = result.toArray();
        if (snapshots.length === 0) {
            return [];
        }

        const snapshot = snapshots[0];
        try {
            const parsed = JSON.parse(snapshot.items_json) as FeedItemRendered[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /**
     * Get feed history
     */
    getHistory(userId: string, limit: number): Array<{
        feed_version: number;
        generated_at: number;
        item_count: number;
    }> {
        const snapshots = this.sql.exec<FeedSnapshot>(
            FEED_QUERIES.GET_HISTORY,
            userId,
            limit
        ).toArray();

        return snapshots.map((s: FeedSnapshot) => {
            let itemCount = 0;
            try {
                const items = JSON.parse(s.items_json) as FeedItemRendered[];
                itemCount = items.length;
            } catch {
                // Ignore parse errors
            }
            return {
                feed_version: s.feed_version,
                generated_at: s.generated_at,
                item_count: itemCount
            };
        });
    }

    /**
     * Get the next feed version number
     */
    getNextVersion(userId: string): number {
        const result = this.sql.exec<{ max_version: number | null }>(
            FEED_QUERIES.GET_MAX_VERSION,
            userId
        );

        const maxVersion = result.one()?.max_version;
        return (maxVersion ?? 0) + 1;
    }
}

