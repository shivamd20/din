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
                raw_text TEXT
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
            CREATE TABLE IF NOT EXISTS patterns (
                pattern_id TEXT PRIMARY KEY,
                description TEXT,
                confidence REAL,
                last_updated INTEGER
            );
        `);
    }

    async log(text: string) {
        const entryId = crypto.randomUUID();
        const createdAt = Date.now();

        this.sql.exec(
            "INSERT INTO entries (entry_id, created_at, raw_text) VALUES (?, ?, ?)",
            entryId,
            createdAt,
            text
        );

        try {
            const extraction = await this.extractInfo(text);
            this.sql.exec(
                "INSERT INTO parses (entry_id, parsed_json, model_version, prompt_version, created_at) VALUES (?, ?, ?, ?, ?)",
                entryId,
                JSON.stringify(extraction),
                "@cf/meta/llama-3-8b-instruct",
                "v1",
                Date.now()
            );

            const todayStr = new Date().toISOString().split("T")[0];
            const reflection = await this.generateReflection(todayStr);

            this.sql.exec(
                `INSERT INTO daily_summary (date, summary_text, flags_json, created_at) 
                 VALUES (?, ?, ?, ?) 
                 ON CONFLICT(date) DO UPDATE SET summary_text = excluded.summary_text, created_at = excluded.created_at`,
                todayStr,
                reflection,
                JSON.stringify({}),
                Date.now()
            );

            return { entryId, summary: { summary_text: reflection } };

        } catch (e) {
            console.error(e);
            return { entryId, message: "Logged. AI pending." };
        }
    }

    async extractInfo(text: string) {
        const prompt = `Analyze this journal entry. Return a valid JSON object with:
        - sentiment: (one of "positive", "neutral", "negative")
        - topics: (list of strings)
        - mood_score: (1-10)
        
        Entry: "${text}"
        
        Respond ONLY with JSON.`;

        const response: any = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        if (response && response.response) {
            try { return JSON.parse(response.response); } catch { }
        }
        return response;
    }

    async generateReflection(date: string) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const entries = this.sql.exec(
            "SELECT raw_text FROM entries WHERE created_at >= ? ORDER BY created_at ASC",
            startOfDay.getTime()
        ).toArray() as { raw_text: string }[];

        const fullText = entries.map(e => e.raw_text).join("\n---\n");

        const prompt = `You are a supportive, insightful companion. Use the user's daily logs below to generate a ONE to TWO sentence reflection.
        Be grounded in what they wrote. Do not give advice unless asked. Be validation-focused.
        
        Logs:
        ${fullText}
        
        Reflection:`;

        const response: any = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [{ role: "user", content: prompt }]
        });

        if (response && response.response) {
            return response.response.trim();
        }
        return "Noted.";
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
