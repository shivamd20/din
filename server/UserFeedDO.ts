import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';

export interface Env {
    GEMINI_API_KEY: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AI: any; // Cloudflare AI binding type
}

export interface FeedItemRendered {
    id: string;
    phrasing: string;
    supporting_note?: string;
    suggested_actions: Array<{ action: string; label: string }>;
}

interface FeedSnapshot {
    id: string;
    user_id: string;
    feed_version: number;
    generated_at: number;
    items_json: string; // JSON string of FeedItemRendered[]
}

export class UserFeedDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize Schema
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS feed_snapshots (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                feed_version INTEGER NOT NULL,
                generated_at INTEGER NOT NULL,
                items_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_feed_user_version ON feed_snapshots(user_id, feed_version DESC);
            CREATE INDEX IF NOT EXISTS idx_feed_user_generated ON feed_snapshots(user_id, generated_at DESC);
        `);
    }

    /**
     * Save a new feed snapshot
     */
    async saveFeedSnapshot(
        userId: string,
        version: number,
        items: FeedItemRendered[]
    ): Promise<string> {
        const id = uuidv4();
        const now = Date.now();
        const itemsJson = JSON.stringify(items);

        this.sql.exec(`
            INSERT INTO feed_snapshots (id, user_id, feed_version, generated_at, items_json)
            VALUES (?, ?, ?, ?, ?)
        `, id, userId, version, now, itemsJson);

        return id;
    }

    /**
     * Get the current (latest) feed for a user
     */
    async getCurrentFeed(userId: string): Promise<FeedItemRendered[]> {
        const result = this.sql.exec<FeedSnapshot>(`
            SELECT * FROM feed_snapshots
            WHERE user_id = ?
            ORDER BY feed_version DESC
            LIMIT 1
        `, userId);

        // Use toArray() and check length instead of one() to handle empty results
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
     * Get feed history for analytics
     */
    async getFeedHistory(userId: string, limit: number = 10): Promise<Array<{
        feed_version: number;
        generated_at: number;
        item_count: number;
    }>> {
        const snapshots = this.sql.exec<FeedSnapshot>(`
            SELECT feed_version, generated_at, items_json
            FROM feed_snapshots
            WHERE user_id = ?
            ORDER BY feed_version DESC
            LIMIT ?
        `, userId, limit).toArray();

        return snapshots.map(s => {
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
     * Get the next feed version number for a user
     */
    async getNextVersion(userId: string): Promise<number> {
        const result = this.sql.exec<{ max_version: number | null }>(`
            SELECT MAX(feed_version) as max_version
            FROM feed_snapshots
            WHERE user_id = ?
        `, userId);

        const maxVersion = result.one()?.max_version;
        return (maxVersion ?? 0) + 1;
    }

    /**
     * Handle fetch requests (for workflow and tRPC)
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        
        // Internal workflow endpoint
        if (url.pathname === '/internal/save-feed' && request.method === 'POST') {
            try {
                const body = await request.json() as {
                    userId?: string;
                    items: FeedItemRendered[];
                };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const version = await this.getNextVersion(userId);
                const snapshotId = await this.saveFeedSnapshot(userId, version, body.items);
                return new Response(JSON.stringify({ snapshotId, version }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Public API endpoints (for tRPC)
        if (url.pathname === '/get-current-feed' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const feed = await this.getCurrentFeed(userId);
                return new Response(JSON.stringify(feed), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url.pathname === '/get-feed-history' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string; limit?: number };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const history = await this.getFeedHistory(userId, body.limit || 10);
                return new Response(JSON.stringify(history), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

