import { v4 as uuidv4 } from 'uuid';
import { FeedDAO } from '../db/daos/FeedDAO';
import type { FeedItemRendered } from '../UserDO';

/**
 * Service layer for Feed business logic
 */
export class FeedService {
    constructor(private feedDAO: FeedDAO) {}

    /**
     * Save a feed snapshot
     */
    saveFeedSnapshot(
        userId: string,
        version: number,
        items: FeedItemRendered[]
    ): string {
        const id = uuidv4();
        const now = Date.now();
        const itemsJson = JSON.stringify(items);

        this.feedDAO.save({
            id,
            userId,
            version,
            generatedAt: now,
            itemsJson,
        });

        return id;
    }

    /**
     * Get the current feed for a user
     */
    getCurrentFeed(userId: string): FeedItemRendered[] {
        return this.feedDAO.getCurrent(userId);
    }

    /**
     * Get feed history
     */
    getFeedHistory(userId: string, limit: number = 10): Array<{
        feed_version: number;
        generated_at: number;
        item_count: number;
    }> {
        return this.feedDAO.getHistory(userId, limit);
    }

    /**
     * Get the next feed version number
     */
    getNextFeedVersion(userId: string): number {
        return this.feedDAO.getNextVersion(userId);
    }
}

