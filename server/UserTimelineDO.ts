import { DurableObject } from "cloudflare:workers";

interface Env {
    AI: any;
    // GEMINI_API_KEY no longer needed
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
                root_id TEXT,
                parent_id TEXT,
                created_at INTEGER,
                raw_text TEXT,
                attachments_json TEXT DEFAULT '[]',
                follow_up_provenance_json TEXT
            );
            CREATE TABLE IF NOT EXISTS daily_summary (
                date TEXT PRIMARY KEY,
                summary_text TEXT,
                flags_json TEXT,
                created_at INTEGER
            );
        `);

        // Migrations
        try {
            this.sql.exec("ALTER TABLE entries ADD COLUMN attachments_json TEXT DEFAULT '[]'");
        } catch (e) { /* Column likely exists */ }

        try {
            this.sql.exec("ALTER TABLE entries ADD COLUMN root_id TEXT");
            this.sql.exec("ALTER TABLE entries ADD COLUMN parent_id TEXT");
            this.sql.exec("ALTER TABLE entries ADD COLUMN follow_up_provenance_json TEXT");
        } catch (e) { /* Columns likely exist */ }
    }

    async log(data: {
        entryId: string,
        text: string,
        attachments?: any[],
        rootId?: string,
        parentId?: string,
        followUp?: any
    }) {
        const { entryId, text, attachments = [], rootId, parentId, followUp } = data;
        const now = Date.now();

        // Default rootId to entryId (self) if not provided -> Root Entry
        const finalRootId = rootId || entryId;

        this.sql.exec(
            `INSERT INTO entries (entry_id, root_id, parent_id, created_at, raw_text, attachments_json, follow_up_provenance_json) 
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(entry_id) DO UPDATE SET 
             raw_text = excluded.raw_text,
             attachments_json = excluded.attachments_json,
             root_id = excluded.root_id,
             parent_id = excluded.parent_id`,
            entryId,
            finalRootId,
            parentId || null,
            now,
            text,
            JSON.stringify(attachments),
            followUp ? JSON.stringify(followUp) : null
        );

        return {
            entryId,
            confirmation: "Captured.",
            followUps: [],
            analysis: undefined
        };
    }

    async append(data: { entryId: string, text: string }) {
        const { entryId, text } = data;
        const existing = this.sql.exec("SELECT raw_text FROM entries WHERE entry_id = ?", entryId).one() as { raw_text: string } | undefined;

        if (existing) {
            const newText = existing.raw_text + "\n" + text;
            this.sql.exec("UPDATE entries SET raw_text = ? WHERE entry_id = ?", newText, entryId);
        }

        return { ok: true };
    }

    async getRecent(limit: number = 50): Promise<any[]> {
        return this.sql
            .exec(
                "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?",
                limit
            )
            .toArray();
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
