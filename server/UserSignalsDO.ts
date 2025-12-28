import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';

export interface Env {
    GEMINI_API_KEY: string;
    AI: any;
}

interface Signal {
    id: string;
    entry_id: string;
    key: string;
    value: number;
    confidence: number;
    model: string;
    version: number;
    generated_at: number;
    expires_at: number | null;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    llm_run_id: string | null;
}

export class UserSignalsDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize Schema
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS signals (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                entry_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value REAL NOT NULL,
                confidence REAL NOT NULL,
                model TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                generated_at INTEGER NOT NULL,
                expires_at INTEGER,
                trigger_capture_id TEXT,
                source_window_days INTEGER,
                llm_run_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_signals_user ON signals(user_id);
            CREATE INDEX IF NOT EXISTS idx_signals_entry ON signals(entry_id);
            CREATE INDEX IF NOT EXISTS idx_signals_trigger ON signals(trigger_capture_id);
            CREATE INDEX IF NOT EXISTS idx_signals_version ON signals(user_id, entry_id, key, version);
        `);
    }

    /**
     * Add a new versioned signal (append-only)
     */
    async addSignal(
        userId: string,
        entryId: string,
        key: string,
        value: number,
        confidence: number,
        model: string,
        triggerCaptureId: string | null,
        sourceWindowDays: number | null,
        llmRunId: string | null
    ): Promise<string> {
        // Get max version for this user/entry/key combination
        const maxVersionResult = this.sql.exec(`
            SELECT MAX(version) as max_version
            FROM signals
            WHERE user_id = ? AND entry_id = ? AND key = ?
        `, userId, entryId, key);

        const maxVersion = (maxVersionResult.one() as { max_version: number | null })?.max_version || 0;
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        this.sql.exec(`
            INSERT INTO signals (
                id, user_id, entry_id, key, value, confidence, model,
                version, generated_at, expires_at,
                trigger_capture_id, source_window_days, llm_run_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, id, userId, entryId, key, value, confidence, model,
            newVersion, now, null,
            triggerCaptureId, sourceWindowDays, llmRunId);

        return id;
    }

    /**
     * Batch add signals (for workflow processing)
     */
    async addSignalsBatch(
        userId: string,
        signals: Array<{
            entry_id: string;
            key: string;
            value: number;
            confidence: number;
        }>,
        model: string,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): Promise<string[]> {
        const ids: string[] = [];
        for (const signal of signals) {
            const id = await this.addSignal(
                userId,
                signal.entry_id,
                signal.key,
                signal.value,
                signal.confidence,
                model,
                triggerCaptureId,
                sourceWindowDays,
                llmRunId
            );
            ids.push(id);
        }
        return ids;
    }

    /**
     * Get signals with optional filters
     */
    async getSignals(
        userId: string,
        options: {
            entry_id?: string;
            trigger_capture_id?: string;
            include_history?: boolean;
            window_days?: number;
        }
    ): Promise<Signal[]> {
        let query = `
            SELECT * FROM signals
            WHERE user_id = ?
        `;
        const params: (string | number)[] = [userId];

        if (options.entry_id) {
            query += ` AND entry_id = ?`;
            params.push(options.entry_id);
        }

        if (options.trigger_capture_id) {
            query += ` AND trigger_capture_id = ?`;
            params.push(options.trigger_capture_id);
        }

        // Add window_days filter if provided
        if (options.window_days) {
            const cutoffTime = Date.now() - (options.window_days * 24 * 60 * 60 * 1000);
            query += ` AND generated_at >= ?`;
            params.push(cutoffTime);
        }

        if (!options.include_history) {
            // Get only latest version for each entry_id + key combination
            const subWhereConditions: string[] = ['user_id = ?'];
            const subParams: (string | number)[] = [userId];
            
            if (options.entry_id) {
                subWhereConditions.push('entry_id = ?');
                subParams.push(options.entry_id);
            }
            if (options.trigger_capture_id) {
                subWhereConditions.push('trigger_capture_id = ?');
                subParams.push(options.trigger_capture_id);
            }
            
            // Calculate cutoffTime once if window_days is provided
            const cutoffTime = options.window_days 
                ? Date.now() - (options.window_days * 24 * 60 * 60 * 1000)
                : null;
            
            if (cutoffTime !== null) {
                subWhereConditions.push('generated_at >= ?');
                subParams.push(cutoffTime);
            }
            
            query = `
                SELECT s1.* FROM signals s1
                INNER JOIN (
                    SELECT entry_id, key, MAX(version) as max_version
                    FROM signals
                    WHERE ${subWhereConditions.join(' AND ')}
                    GROUP BY entry_id, key
                ) s2 ON s1.entry_id = s2.entry_id 
                    AND s1.key = s2.key 
                    AND s1.version = s2.max_version
                WHERE s1.user_id = ?
            `;
            
            // Add window_days filter to outer query if provided
            if (cutoffTime !== null) {
                query += ` AND s1.generated_at >= ?`;
            }
            
            // Build params: subParams (includes userId and optional filters) + userId (for outer WHERE) + optional cutoffTime (for outer WHERE)
            params.length = 0;
            params.push(...subParams); // This includes userId and all subquery params
            params.push(userId); // For outer WHERE s1.user_id = ?
            if (cutoffTime !== null) {
                params.push(cutoffTime); // For outer WHERE s1.generated_at >= ?
            }
        }

        query += ` ORDER BY generated_at DESC`;

        const result = this.sql.exec(query, ...params);
        return result.toArray() as unknown as Signal[];
    }

    /**
     * Handle internal fetch requests (for workflow)
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        
        if (url.pathname === '/internal/add-signals-batch' && request.method === 'POST') {
            const body = await request.json() as {
                userId?: string;
                signals: Array<{ entry_id: string; key: string; value: number; confidence: number }>;
                model: string;
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
            const ids = await this.addSignalsBatch(
                userId,
                body.signals,
                body.model,
                body.triggerCaptureId,
                body.sourceWindowDays,
                body.llmRunId
            );
            return new Response(JSON.stringify({ ids }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/internal/get-signals' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                // Get recent signals (last 30 days)
                const signals = await this.getSignals(userId, {
                    include_history: false,
                    window_days: 30
                });
                return new Response(JSON.stringify({ signals }), {
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

