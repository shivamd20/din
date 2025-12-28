import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';

export interface Env {
    GEMINI_API_KEY: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AI: any; // Cloudflare AI binding type
}

interface Task {
    id: string;
    user_id: string;
    content: string;
    status: string;
    priority: string | null;
    due_date: number | null;
    version: number;
    created_at: number;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    llm_run_id: string | null;
}

export class UserTasksDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize Schema
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                priority TEXT,
                due_date INTEGER,
                version INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                trigger_capture_id TEXT,
                source_window_days INTEGER,
                llm_run_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
            CREATE INDEX IF NOT EXISTS idx_tasks_trigger ON tasks(trigger_capture_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_version ON tasks(user_id, content, version);
        `);
    }

    /**
     * Add a new versioned task (append-only)
     * Note: We version by content hash or use a unique identifier
     * For simplicity, we'll version by content + user_id
     */
    async addTask(
        userId: string,
        content: string,
        status: string = 'pending',
        priority: string | null = null,
        dueDate: number | null = null,
        triggerCaptureId: string | null = null,
        sourceWindowDays: number | null = null,
        llmRunId: string | null = null
    ): Promise<string> {
        // Get max version for this user/content combination
        // We use content as the identifier for versioning tasks
        const maxVersionResult = this.sql.exec(`
            SELECT MAX(version) as max_version
            FROM tasks
            WHERE user_id = ? AND content = ?
        `, userId, content);

        const maxVersion = (maxVersionResult.one() as { max_version: number | null })?.max_version || 0;
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        this.sql.exec(`
            INSERT INTO tasks (
                id, user_id, content, status, priority, due_date,
                version, created_at, trigger_capture_id, source_window_days, llm_run_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, id, userId, content, status, priority, dueDate,
            newVersion, now, triggerCaptureId, sourceWindowDays, llmRunId);

        return id;
    }

    /**
     * Batch add tasks (for workflow processing)
     */
    async addTasksBatch(
        userId: string,
        tasks: Array<{
            content: string;
            priority?: string;
            due_date?: number;
            status?: string;
        }>,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): Promise<string[]> {
        const ids: string[] = [];
        for (const task of tasks) {
            const id = await this.addTask(
                userId,
                task.content,
                task.status || 'pending',
                task.priority || null,
                task.due_date || null,
                triggerCaptureId,
                sourceWindowDays,
                llmRunId
            );
            ids.push(id);
        }
        return ids;
    }

    /**
     * Get tasks with optional filters
     */
    async getTasks(
        userId: string,
        options: {
            status?: string;
            include_history?: boolean;
            trigger_capture_id?: string;
        }
    ): Promise<Task[]> {
        let query = `
            SELECT * FROM tasks
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
            // Get only latest version for each content
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
                SELECT t1.* FROM tasks t1
                INNER JOIN (
                    SELECT content, MAX(version) as max_version
                    FROM tasks
                    WHERE ${subWhereConditions.join(' AND ')}
                    GROUP BY content
                ) t2 ON t1.content = t2.content 
                    AND t1.version = t2.max_version
                WHERE t1.user_id = ?
            `;
            params.length = 0;
            params.push(...subParams, userId);
        }

        query += ` ORDER BY created_at DESC`;

        const result = this.sql.exec(query, ...params);
        return result.toArray() as unknown as Task[];
    }

    /**
     * Handle internal fetch requests (for workflow)
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        
        if (url.pathname === '/internal/add-tasks-batch' && request.method === 'POST') {
            const body = await request.json() as {
                userId?: string;
                tasks: Array<{ content: string; priority?: string; due_date?: number; status?: string }>;
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
            const ids = await this.addTasksBatch(
                userId,
                body.tasks,
                body.triggerCaptureId,
                body.sourceWindowDays,
                body.llmRunId
            );
            return new Response(JSON.stringify({ ids }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/internal/get-tasks' && request.method === 'POST') {
            try {
                const body = await request.json() as { userId?: string };
                const userId = body.userId || this.state.id.name || '';
                if (!userId) {
                    return new Response(JSON.stringify({ error: 'User ID not found' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const tasks = await this.getTasks(userId, {
                    status: undefined, // Get all statuses, filter in generator
                    include_history: false
                });
                return new Response(JSON.stringify({ tasks }), {
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

