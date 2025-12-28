import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';

export interface Env {
    GEMINI_API_KEY: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AI: any; // Cloudflare AI binding type
}

interface Commitment {
    id: string;
    user_id: string;
    origin_entry_id: string;
    content: string;
    strength: string;
    horizon: string;
    created_at: number;
    expires_at: number | null;
    last_acknowledged_at: number | null;
    version: number;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    status: string;
    llm_run_id: string | null;
}

export class UserCommitmentsDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize Schema
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS commitments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                origin_entry_id TEXT NOT NULL,
                content TEXT NOT NULL,
                strength TEXT NOT NULL,
                horizon TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER,
                last_acknowledged_at INTEGER,
                version INTEGER NOT NULL DEFAULT 1,
                trigger_capture_id TEXT,
                source_window_days INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                llm_run_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id);
            CREATE INDEX IF NOT EXISTS idx_commitments_trigger ON commitments(trigger_capture_id);
            CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(user_id, status);
            CREATE INDEX IF NOT EXISTS idx_commitments_version ON commitments(user_id, origin_entry_id, version);
        `);
    }

    /**
     * Add a new versioned commitment (append-only)
     */
    async addCommitment(
        userId: string,
        originEntryId: string,
        content: string,
        strength: string,
        horizon: string,
        triggerCaptureId: string | null,
        sourceWindowDays: number | null,
        llmRunId: string | null,
        status: string = 'active'
    ): Promise<string> {
        // Get max version for this user/origin_entry_id combination
        const maxVersionResult = this.sql.exec(`
            SELECT MAX(version) as max_version
            FROM commitments
            WHERE user_id = ? AND origin_entry_id = ?
        `, userId, originEntryId);

        const maxVersion = (maxVersionResult.one() as { max_version: number | null })?.max_version || 0;
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        this.sql.exec(`
            INSERT INTO commitments (
                id, user_id, origin_entry_id, content, strength, horizon,
                created_at, expires_at, last_acknowledged_at,
                version, trigger_capture_id, source_window_days, status, llm_run_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, id, userId, originEntryId, content, strength, horizon,
            now, null, null,
            newVersion, triggerCaptureId, sourceWindowDays, status, llmRunId);

        return id;
    }

    /**
     * Batch add commitments (for workflow processing)
     */
    async addCommitmentsBatch(
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
    ): Promise<string[]> {
        const ids: string[] = [];
        for (const commitment of commitments) {
            const id = await this.addCommitment(
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
     * Get commitments with optional filters
     */
    async getCommitments(
        userId: string,
        options: {
            status?: string;
            include_history?: boolean;
            trigger_capture_id?: string;
        }
    ): Promise<Commitment[]> {
        let query = `
            SELECT * FROM commitments
            WHERE user_id = ?
        `;
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
            // Get only latest version for each origin_entry_id
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
            
            query = `
                SELECT c1.* FROM commitments c1
                INNER JOIN (
                    SELECT origin_entry_id, MAX(version) as max_version
                    FROM commitments
                    WHERE ${subWhereConditions.join(' AND ')}
                    GROUP BY origin_entry_id
                ) c2 ON c1.origin_entry_id = c2.origin_entry_id 
                    AND c1.version = c2.max_version
                WHERE c1.user_id = ?
            `;
            params.length = 0;
            params.push(...subParams, userId);
        }

        query += ` ORDER BY created_at DESC`;

        const result = this.sql.exec(query, ...params);
        return result.toArray() as unknown as Commitment[];
    }

    /**
     * Handle internal fetch requests (for workflow)
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        
        if (url.pathname === '/internal/add-commitments-batch' && request.method === 'POST') {
            const body = await request.json() as {
                userId?: string;
                commitments: Array<{ origin_entry_id: string; strength: string; horizon: string; content: string; status?: string }>;
                triggerCaptureId: string;
                sourceWindowDays: number;
                llmRunId: string;
            };
            const userId = body.userId || this.state.id.name || '';
            if (!userId) {
                return new Response(JSON.stringify({ error: 'User ID not found' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const ids = await this.addCommitmentsBatch(
                userId,
                body.commitments,
                body.triggerCaptureId,
                body.sourceWindowDays,
                body.llmRunId
            );
            return new Response(JSON.stringify({ ids }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/internal/get-commitments' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const commitments = await this.getCommitments(userId, {
                    status: undefined, // Get all, filter in generator
                    include_history: false
                });
                return new Response(JSON.stringify({ commitments }), {
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

