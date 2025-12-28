/**
 * SQL Query Constants
 * Centralized location for all SQL queries used across the application
 */

// ============================================================================
// Schema Initialization
// ============================================================================

export const SCHEMA_QUERIES = {
    ENTRIES_TABLE: `
        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            source TEXT NOT NULL,
            attachments_json TEXT,
            root_id TEXT,
            parent_id TEXT,
            linked_task_id TEXT,
            linked_commitment_id TEXT,
            event_type TEXT,
            payload_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_entries_user_time ON entries(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_entries_linked_task ON entries(linked_task_id);
        CREATE INDEX IF NOT EXISTS idx_entries_linked_commitment ON entries(linked_commitment_id);
    `,

    SIGNALS_TABLE: `
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
    `,

    COMMITMENTS_TABLE: `
        CREATE TABLE IF NOT EXISTS commitments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            origin_entry_id TEXT NOT NULL,
            content TEXT NOT NULL,
            strength TEXT NOT NULL,
            horizon TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            last_acknowledged_at INTEGER,
            progress_score REAL NOT NULL DEFAULT 0.0,
            source_type TEXT NOT NULL DEFAULT 'ai',
            version INTEGER NOT NULL DEFAULT 1,
            trigger_capture_id TEXT,
            source_window_days INTEGER,
            llm_run_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id);
        CREATE INDEX IF NOT EXISTS idx_commitments_trigger ON commitments(trigger_capture_id);
        CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_commitments_version ON commitments(user_id, origin_entry_id, version);
    `,

    TASKS_TABLE: `
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            commitment_id TEXT,
            origin_entry_id TEXT NOT NULL,
            planned_date INTEGER,
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            preferred_window TEXT,
            task_type TEXT NOT NULL DEFAULT 'planned',
            status TEXT NOT NULL DEFAULT 'planned',
            created_at INTEGER NOT NULL,
            last_event_capture_id TEXT,
            time_spent_minutes INTEGER NOT NULL DEFAULT 0,
            confidence_score REAL NOT NULL DEFAULT 0.5,
            snoozed_until INTEGER,
            source_type TEXT NOT NULL DEFAULT 'ai',
            version INTEGER NOT NULL DEFAULT 1,
            trigger_capture_id TEXT,
            source_window_days INTEGER,
            llm_run_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_tasks_commitment ON tasks(commitment_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_trigger ON tasks(trigger_capture_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
    `,

    FEED_SNAPSHOTS_TABLE: `
        CREATE TABLE IF NOT EXISTS feed_snapshots (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            feed_version INTEGER NOT NULL,
            generated_at INTEGER NOT NULL,
            items_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_feed_user_version ON feed_snapshots(user_id, feed_version DESC);
        CREATE INDEX IF NOT EXISTS idx_feed_user_generated ON feed_snapshots(user_id, generated_at DESC);
    `,

    PLANNER_STATE_TABLE: `
        CREATE TABLE IF NOT EXISTS planner_state (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            last_planned_date INTEGER NOT NULL,
            last_plan_version INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_planner_user ON planner_state(user_id);
    `,

    EVENTS_TABLE: `
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            capture_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload_json TEXT,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
        CREATE INDEX IF NOT EXISTS idx_events_capture ON events(capture_id);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    `,
};

// ============================================================================
// Entry Queries
// ============================================================================

export const ENTRY_QUERIES = {
    CHECK_EXISTS: `SELECT COUNT(*) as c FROM entries WHERE id = ?`,
    
    INSERT: `
        INSERT INTO entries (
            id, user_id, text, created_at, source, attachments_json,
            root_id, parent_id, linked_task_id, linked_commitment_id,
            event_type, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    GET_BY_USER_TIME_WINDOW: `
        SELECT id, text, created_at FROM entries 
        WHERE user_id = ? AND created_at >= ? 
        ORDER BY created_at ASC
    `,

    GET_HOME: `
        SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `,

    GET_RECENT: `SELECT * FROM entries ORDER BY created_at DESC LIMIT ?`,

    GET_BY_ID: `SELECT * FROM entries WHERE id = ?`,
};

// ============================================================================
// Signal Queries
// ============================================================================

export const SIGNAL_QUERIES = {
    GET_MAX_VERSION: `
        SELECT MAX(version) as max_version
        FROM signals
        WHERE user_id = ? AND entry_id = ? AND key = ?
    `,

    INSERT: `
        INSERT INTO signals (
            id, user_id, entry_id, key, value, confidence, model,
            version, generated_at, expires_at,
            trigger_capture_id, source_window_days, llm_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    GET_BASE: `SELECT * FROM signals WHERE user_id = ?`,

    GET_LATEST_VERSION: (subWhereConditions: string[]) => `
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
    `,
};

// ============================================================================
// Commitment Queries
// ============================================================================

export const COMMITMENT_QUERIES = {
    GET_MAX_VERSION: `
        SELECT MAX(version) as max_version
        FROM commitments
        WHERE user_id = ? AND origin_entry_id = ?
    `,

    INSERT: `
        INSERT INTO commitments (
            id, user_id, origin_entry_id, content, strength, horizon,
            created_at, expires_at, last_acknowledged_at,
            version, trigger_capture_id, source_window_days, status, llm_run_id, source_type, progress_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    GET_BASE: `SELECT * FROM commitments WHERE user_id = ?`,

    GET_LATEST_VERSION: (subWhereConditions: string[]) => `
        SELECT c1.* FROM commitments c1
        INNER JOIN (
            SELECT origin_entry_id, MAX(version) as max_version
            FROM commitments
            WHERE ${subWhereConditions.join(' AND ')}
            GROUP BY origin_entry_id
        ) c2 ON c1.origin_entry_id = c2.origin_entry_id 
            AND c1.version = c2.max_version
        WHERE c1.user_id = ?
    `,
};

// ============================================================================
// Task Queries
// ============================================================================

export const TASK_QUERIES = {
    GET_MAX_VERSION: `
        SELECT MAX(version) as max_version
        FROM tasks
        WHERE user_id = ? AND content = ?
    `,

    INSERT: `
        INSERT INTO tasks (
            id, user_id, content, commitment_id, origin_entry_id,
            planned_date, duration_minutes, preferred_window, task_type, status,
            created_at, last_event_capture_id, time_spent_minutes, confidence_score,
            snoozed_until, source_type, version, trigger_capture_id,
            source_window_days, llm_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    GET_BASE: `SELECT * FROM tasks WHERE user_id = ?`,

    GET_LATEST_VERSION: (subWhereConditions: string[]) => `
        SELECT t1.* FROM tasks t1
        INNER JOIN (
            SELECT content, MAX(version) as max_version
            FROM tasks
            WHERE ${subWhereConditions.join(' AND ')}
            GROUP BY content
        ) t2 ON t1.content = t2.content 
            AND t1.version = t2.max_version
        WHERE t1.user_id = ?
    `,
};

// ============================================================================
// Feed Queries
// ============================================================================

export const FEED_QUERIES = {
    INSERT: `
        INSERT INTO feed_snapshots (id, user_id, feed_version, generated_at, items_json)
        VALUES (?, ?, ?, ?, ?)
    `,

    GET_CURRENT: `
        SELECT * FROM feed_snapshots
        WHERE user_id = ?
        ORDER BY feed_version DESC
        LIMIT 1
    `,

    GET_HISTORY: `
        SELECT feed_version, generated_at, items_json
        FROM feed_snapshots
        WHERE user_id = ?
        ORDER BY feed_version DESC
        LIMIT ?
    `,

    GET_MAX_VERSION: `
        SELECT MAX(feed_version) as max_version
        FROM feed_snapshots
        WHERE user_id = ?
    `,
};

