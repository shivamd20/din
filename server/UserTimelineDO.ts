import { DurableObject } from "cloudflare:workers";
import { AIService } from "./ai-service";
import { DEFAULT_MODEL_ID } from "./ai-model";
import { v4 as uuidv4 } from 'uuid';

export interface Env {
    GEMINI_API_KEY: string;
    AI: any;
}

interface Entry {
    id: string;
    user_id: string;
    text: string;
    created_at: number;
    source: string;
    [key: string]: string | number | null;
}

interface Signal {
    id: string;
    entry_id: string;
    key: string;
    value: string;
    confidence: number;
    model: string;
    version: number;
    generated_at: number;
    expires_at: number | null;
    [key: string]: string | number | null;
}

interface Commitment {
    id: string;
    user_id: string;
    origin_entry_id: string;
    strength: string;
    horizon: string;
    created_at: number;
    expires_at: number | null;
    last_acknowledged_at: number | null;
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
    private aiPayload: AIService;
    // Keep reference to state for waitUntil
    private state: DurableObjectState;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;
        this.aiPayload = new AIService(env as any);

        // Initialize Schema
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

      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL,
        model TEXT NOT NULL,
        version INTEGER NOT NULL,
        generated_at INTEGER NOT NULL,
        expires_at INTEGER,
        FOREIGN KEY(entry_id) REFERENCES entries(id)
      );
      CREATE INDEX IF NOT EXISTS idx_signals_entry ON signals(entry_id);

      CREATE TABLE IF NOT EXISTS state (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        decay_half_life INTEGER NOT NULL,
        PRIMARY KEY(user_id, key)
      );

      CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        origin_entry_id TEXT NOT NULL,
        strength TEXT NOT NULL,
        horizon TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        last_acknowledged_at INTEGER,
        FOREIGN KEY(origin_entry_id) REFERENCES entries(id)
      );
      CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id);
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

        // Use waitUntil to ensure background processing completes
        this.state.waitUntil(
            this.processSignals(entryId, text).catch(err => console.error("Signal processing failed", err))
        );

        return entryId;
    }

    async processSignals(entryId: string, text: string) {
        // Check if signals exist
        const existing = this.sql.exec("SELECT COUNT(*) as count FROM signals WHERE entry_id = ?", entryId).one();
        if (existing && (existing as any).count > 0) return;

        try {
            const signals = await this.aiPayload.extractSignals(text);
            const now = Date.now();
            const model = DEFAULT_MODEL_ID;
            const version = 1;

            for (const [key, value] of Object.entries(signals)) {
                this.sql.exec(`
          INSERT INTO signals (id, entry_id, key, value, confidence, model, version, generated_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, uuidv4(), entryId, key, String(value), 1.0, model, version, now, null);
            }
        } catch (e) {
            console.error("AI Error", e);
        }
    }

    async getHome(userId: string) {
        // 1. Load last 50 entries
        const entries = this.sql.exec<Entry>(`
      SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `, userId).toArray();

        const activeCommitments = this.sql.exec<Commitment>(`
      SELECT * FROM commitments WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
    `, userId, Date.now()).toArray();

        // 2. Fetch/Regenerate signals
        const entrySignalsMap = new Map<string, Record<string, number>>();

        for (const entry of entries) {
            let signals = this.sql.exec<Signal>(`SELECT * FROM signals WHERE entry_id = ?`, entry.id).toArray();

            if (signals.length === 0) {
                await this.processSignals(entry.id, entry.text);
                signals = this.sql.exec<Signal>(`SELECT * FROM signals WHERE entry_id = ?`, entry.id).toArray();
            }

            const map: Record<string, number> = {};
            signals.forEach(s => map[s.key] = parseFloat(s.value));
            entrySignalsMap.set(entry.id, map);
        }

        // 5. Load State
        const stateSnapshot = this.sql.exec<State>(`SELECT * FROM state WHERE user_id = ?`, userId).toArray();
        const stateMap = new Map<string, State>();
        stateSnapshot.forEach(s => stateMap.set(s.key, s));

        // 6. State Update Rules & Decay
        // "State is updated during Home computation."
        const now = Date.now();

        // Example: energy_estimate = inverse of recent tone_stress (last 6 hours)
        // Find recent entries (6h)
        const recent6h = entries.filter(e => (now - e.created_at) < 6 * 60 * 60 * 1000);
        let avgToneStress = 0;
        let count = 0;
        for (const e of recent6h) {
            const signals = entrySignalsMap.get(e.id);
            if (signals && signals['tone_stress'] !== undefined) {
                avgToneStress += signals['tone_stress'];
                count++;
            }
        }
        if (count > 0) avgToneStress /= count;

        // Initial/Default energy is 1.0. If high stress, energy drops.
        // energy = 1.0 - avgToneStress
        const newEnergy = 1.0 - avgToneStress;

        // Upsert energy_estimate
        this.sql.exec(`
      INSERT OR REPLACE INTO state (user_id, key, value, updated_at, decay_half_life)
      VALUES (?, 'energy_estimate', ?, ?, ?)
    `, userId, String(newEnergy), now, 4 * 60 * 60 * 1000); // 4h half life example

        // Decay other keys (or all keys if not updated)
        // For simplicity, we just recalculated energy_estimate.
        // Anything else in valid snapshot should be decayed if not just updated?
        // Current snapshot includes old values. Let's return the *fresh* snapshot.
        // So we should re-fetch or apply updates to map.

        // Re-fetch state after updates
        const finalStateSnapshot = this.sql.exec<State>(`SELECT * FROM state WHERE user_id = ?`, userId).toArray();

        // Apply decay to values for display/return (but maybe not persist decay on every read?
        // Spec: "State... Always decays". "Decay formula... value(t)".
        // Usually decay is applied on read.
        const decayedState = finalStateSnapshot.map(s => {
            const val = parseFloat(s.value);
            const age = now - s.updated_at;
            const decayed = val * Math.pow(2, -(age / s.decay_half_life));
            return { ...s, value: String(decayed) };
        });


        // 7. Score candidates
        const cards = entries.map(entry => {
            const signals = entrySignalsMap.get(entry.id) || {};
            const actionability = signals['actionability'] || 0;
            const tone_stress = signals['tone_stress'] || 0;
            const pressure = (actionability + tone_stress) / 2; // Derived

            const ageHours = (Date.now() - entry.created_at) / (1000 * 60 * 60);
            const recency = Math.max(0, 1 - (ageHours / 24));

            const isCommitted = activeCommitments.some(c => c.origin_entry_id === entry.id);
            const commitmentBoost = isCommitted ? 1 : 0;

            const score = (0.35 * actionability) + (0.30 * pressure) + (0.15 * recency) + (0.20 * commitmentBoost);

            return {
                id: entry.id,
                type: 'entry',
                text: entry.text,
                score,
                actions: [],
                signals
            };
        }).filter(c => c.score >= 0.45)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return {
            cards,
            state_snapshot: decayedState
        };
    }

    async addCommitment(userId: string, entryId: string, strength: string, horizon: string) {
        const id = uuidv4();
        const now = Date.now();
        this.sql.exec(`
      INSERT INTO commitments (id, user_id, origin_entry_id, strength, horizon, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id, userId, entryId, strength, horizon, now);
        return id;
    }

    async getRecentEntries(limit: number = 20) {
        // Since DO is scoped to user, we can trust the DB contents, but keeping user_id consistency is good pratice if we had it.
        // However, we don't pass userId here easily. Since DB is private to this DO (userId), selecting all is correct for "this user".
        return this.sql.exec<Entry>(`SELECT * FROM entries ORDER BY created_at DESC LIMIT ?`, limit).toArray();
    }
}


