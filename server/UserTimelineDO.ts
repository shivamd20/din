import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowParams } from "./SignalsWorkflow";

export interface Env {
    GEMINI_API_KEY: string;
    AI: any;
    SIGNALS_WORKFLOW?: Workflow<WorkflowParams>;
    FEED_WORKFLOW?: Workflow<{ userId: string; triggerCaptureId?: string }>;
}

interface Entry {
    id: string;
    user_id: string;
    text: string;
    created_at: number;
    source: string;
    [key: string]: string | number | null;
}

interface State {
    user_id: string;
    key: string;
    value: string;
    updated_at: number;
    decay_half_life: number;
    [key: string]: string | number | null;
}

export class UserTimelineDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize Schema - Only entries and state (event log)
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                source TEXT NOT NULL,
                attachments_json TEXT,
                root_id TEXT,
                parent_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_entries_user_time ON entries(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS state (
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                decay_half_life INTEGER NOT NULL,
                PRIMARY KEY(user_id, key)
            );
        `);
    }

    async addEntry(
        userId: string,
        text: string,
        source: string,
        opts?: {
            id?: string,
            attachments?: any[],
            rootId?: string,
            parentId?: string
        }
    ): Promise<string> {
        const entryId = opts?.id || uuidv4();
        const createdAt = Date.now();
        const attachmentsJson = opts?.attachments ? JSON.stringify(opts.attachments) : null;
        const rootId = opts?.rootId || null;
        const parentId = opts?.parentId || null;

        // Check if entry exists (idempotency for sync)
        const countResult = this.sql.exec("SELECT COUNT(*) as c FROM entries WHERE id = ?", entryId).one() as { c: number };
        const exists = countResult.c > 0;
        if (!exists) {
            this.sql.exec(`
          INSERT INTO entries (id, user_id, text, created_at, source, attachments_json, root_id, parent_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, entryId, userId, text, createdAt, source, attachmentsJson, rootId, parentId);
        } else {
            // Optional: Update if exists? Sync usually implies upsert or ignore.
            // "Append-only" rule in Phase 1 spec suggests ignore.
            // But if offline capture updated text, we might want update.
            // For now, respect "Append-only" rule for *new* IDs, but maybe existing IDs implies we already have it.
            // Let's UPDATE to be safe for "keep UI working" (sync might be correcting data).
            // But Phase 1 spec: "Rules: Append-only".
            // I will stick to IGNORE if exists, to be safe with Spec.
        }

        // Trigger workflow for background processing (non-blocking)
        if (this.env.SIGNALS_WORKFLOW) {
            this.state.waitUntil(
                this.env.SIGNALS_WORKFLOW.create({
                    id: `${userId}-${entryId}-${Date.now()}`,
                    params: {
                        userId,
                        triggerCaptureId: entryId,
                        windowDays: 30, // Default window
                    },
                }).then(() => {
                    // After signals workflow completes, trigger feed workflow if available
                    if (this.env.FEED_WORKFLOW) {
                        return this.env.FEED_WORKFLOW.create({
                            id: `${userId}-feed-${Date.now()}`,
                            params: {
                                userId,
                                triggerCaptureId: entryId,
                            },
                        }).catch((err: unknown) => {
                            console.error("Failed to trigger feed workflow:", err);
                        });
                    }
                }).catch((err: unknown) => {
                    console.error("Failed to trigger signals workflow:", err);
                })
            );
        }

        return entryId;
    }

    /**
     * Fetch captures for a time window (used by workflow)
     */
    async getCapturesForWindow(userId: string, windowDays: number): Promise<Array<{ id: string; text: string; created_at: number }>> {
        const cutoffTime = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
        const entries = this.sql.exec<Entry>(`
            SELECT id, text, created_at FROM entries 
            WHERE user_id = ? AND created_at >= ? 
            ORDER BY created_at ASC
        `, userId, cutoffTime).toArray();

        return entries.map(e => ({
            id: e.id,
            text: e.text,
            created_at: e.created_at
        }));
    }

    async getHome(userId: string) {
        // Load last 50 entries
        const entries = this.sql.exec<Entry>(`
            SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `, userId).toArray();

        // Load State
        const stateSnapshot = this.sql.exec<State>(`SELECT * FROM state WHERE user_id = ?`, userId).toArray();
        const now = Date.now();

        // Apply decay to values for display
        const decayedState = stateSnapshot.map(s => {
            const val = parseFloat(s.value);
            const age = now - s.updated_at;
            const decayed = val * Math.pow(2, -(age / s.decay_half_life));
            return { ...s, value: String(decayed) };
        });

        // Simple scoring without signals/commitments (those come from separate DOs)
        const cards = entries.map(entry => {
            const ageHours = (Date.now() - entry.created_at) / (1000 * 60 * 60);
            const recency = Math.max(0, 1 - (ageHours / 24));
            const score = recency; // Simple recency-based scoring for now

            return {
                id: entry.id,
                type: 'entry',
                text: entry.text,
                score,
                actions: [],
                signals: {} // Signals will be fetched separately from UserSignalsDO
            };
        }).filter(c => c.score >= 0.45)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return {
            cards,
            state_snapshot: decayedState
        };
    }

    async getRecentEntries(limit: number = 20) {
        return this.sql.exec<Entry>(`SELECT * FROM entries ORDER BY created_at DESC LIMIT ?`, limit).toArray();
    }

    /**
     * Handle internal fetch requests (for workflow)
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        
        if (url.pathname === '/internal/get-captures' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string; windowDays: number };
                // Use userId from request body if provided, otherwise fall back to DO state
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const captures = await this.getCapturesForWindow(userId, body.windowDays);
                return new Response(JSON.stringify({ captures }), {
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


