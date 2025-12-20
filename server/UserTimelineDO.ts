import { DurableObject } from "cloudflare:workers";

interface Env {
    AI: any;
}

export class UserTimelineDO extends DurableObject<Env> {
    sql: DurableObjectState["storage"]["sql"];

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;

        this.initializeSchema();
    }

    initializeSchema() {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS entries (
                entry_id TEXT PRIMARY KEY,
                created_at INTEGER,
                raw_text TEXT,
                attachments_json TEXT DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS parses (
                entry_id TEXT,
                parsed_json TEXT,
                model_version TEXT,
                prompt_version TEXT,
                created_at INTEGER,
                PRIMARY KEY (entry_id, model_version)
            );
            CREATE TABLE IF NOT EXISTS daily_summary (
                date TEXT PRIMARY KEY,
                summary_text TEXT,
                flags_json TEXT,
                created_at INTEGER
            );
        `);

        // Migration for v1 (adding attachments)
        try {
            this.sql.exec("ALTER TABLE entries ADD COLUMN attachments_json TEXT DEFAULT '[]'");
        } catch (e) {
            // Column likely exists
        }
    }

    async log(data: { entryId: string, text: string, attachments?: any[] }) {
        const { entryId, text, attachments = [] } = data;
        const now = Date.now();

        // Idempotency & Sync: UPSERT strategy.
        // If entry exists (e.g. from offline sync), we update the text to match client state.
        // This handles "Append" scenarios where client syncs the full updated text.
        this.sql.exec(
            `INSERT INTO entries (entry_id, created_at, raw_text, attachments_json) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(entry_id) DO UPDATE SET 
             raw_text = excluded.raw_text,
             attachments_json = excluded.attachments_json`,
            entryId,
            now,
            text,
            JSON.stringify(attachments)
        );

        // Always schedule AI on write/update
        this.scheduleAI(entryId, text);

        return { entryId, confirmation: "Captured." };
    }

    async append(data: { entryId: string, text: string }) {
        const { entryId, text } = data;

        // Append text to existing entry. 
        // We simply concatenate with a newline for now.
        const existing = this.sql.exec("SELECT raw_text FROM entries WHERE entry_id = ?", entryId).one() as { raw_text: string } | undefined;

        if (existing) {
            const newText = existing.raw_text + "\n" + text;
            this.sql.exec("UPDATE entries SET raw_text = ? WHERE entry_id = ?", newText, entryId);

            // Re-schedule AI to process the updated text
            this.scheduleAI(entryId, newText);
        }

        return { ok: true };
    }

    async scheduleAI(entryId: string, text: string) {
        // AI Logic deferred or inline. Kept simple for now.
        // In a real production app, this might be a queue. 
        // Here we just trigger it and don't wait for the result in the main response to keep sync fast.

        // checking for followups could be done here.
    }

    // ... (Keep existing getToday and other methods if needed for other parts, simplified below)

    async getRecent(limit: number = 50): Promise<{ entry_id: string, created_at: number, raw_text: string, attachments_json: string }[]> {
        // Fetch most recent entries for syncing/timeline population
        return this.sql
            .exec(
                "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?",
                limit
            )
            .toArray() as { entry_id: string, created_at: number, raw_text: string, attachments_json: string }[];
    }

    async getToday() {
        const todayStr = new Date().toISOString().split("T")[0];
        const summaryResults = this.sql
            .exec("SELECT * FROM daily_summary WHERE date = ?", todayStr)
            .toArray();
        const summary = summaryResults[0] || null;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const entries = this.sql
            .exec(
                "SELECT * FROM entries WHERE created_at >= ? ORDER BY created_at ASC",
                startOfDay.getTime()
            )
            .toArray();

        return { summary, entries };
    }
}
