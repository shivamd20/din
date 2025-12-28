# Entity Relationship Diagram (ERD)

## 1. Database Schema Overview

The system uses SQLite databases within Durable Objects. Each user has isolated databases across multiple DOs.

## 2. Authentication Schema (D1 Database)

### 2.1 User Table
```
┌─────────────────────────────────────┐
│              user                   │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ name TEXT NOT NULL                  │
│ email TEXT UNIQUE                   │
│ emailVerified BOOLEAN NOT NULL      │
│ image TEXT                          │
│ createdAt TIMESTAMP NOT NULL        │
│ updatedAt TIMESTAMP NOT NULL        │
│ isAnonymous BOOLEAN                 │
└─────────────────────────────────────┘
```

### 2.2 Session Table
```
┌─────────────────────────────────────┐
│            session                  │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ expiresAt TIMESTAMP NOT NULL         │
│ token TEXT NOT NULL UNIQUE           │
│ createdAt TIMESTAMP NOT NULL         │
│ updatedAt TIMESTAMP NOT NULL         │
│ ipAddress TEXT                       │
│ userAgent TEXT                       │
│ userId (FK) TEXT → user.id          │
└─────────────────────────────────────┘
```

### 2.3 Account Table
```
┌─────────────────────────────────────┐
│            account                  │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ accountId TEXT NOT NULL             │
│ providerId TEXT NOT NULL            │
│ userId (FK) TEXT → user.id         │
│ accessToken TEXT                    │
│ refreshToken TEXT                   │
│ idToken TEXT                        │
│ accessTokenExpiresAt TIMESTAMP     │
│ refreshTokenExpiresAt TIMESTAMP     │
│ scope TEXT                          │
│ password TEXT                       │
│ createdAt TIMESTAMP NOT NULL         │
│ updatedAt TIMESTAMP NOT NULL         │
└─────────────────────────────────────┘
```

### 2.4 Verification Table
```
┌─────────────────────────────────────┐
│         verification                │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ identifier TEXT NOT NULL            │
│ value TEXT NOT NULL                 │
│ expiresAt TIMESTAMP NOT NULL         │
│ createdAt TIMESTAMP                 │
│ updatedAt TIMESTAMP                 │
└─────────────────────────────────────┘
```

## 3. UserTimelineDO Schema

### 3.1 Entries Table
```
┌─────────────────────────────────────┐
│            entries                   │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ user_id TEXT NOT NULL               │
│ text TEXT NOT NULL                  │
│ created_at INTEGER NOT NULL         │
│ source TEXT NOT NULL                │
│ attachments_json TEXT               │
│ root_id TEXT                        │
│ parent_id TEXT                      │
└─────────────────────────────────────┘
         │
         │ (self-reference)
         ▼
    ┌─────────┐
    │ entries │ (root_id, parent_id)
    └─────────┘
```

**Indexes:**
- `idx_entries_user_time` on (user_id, created_at DESC)

**Relationships:**
- `root_id` → `entries.id` (self-reference for thread roots)
- `parent_id` → `entries.id` (self-reference for thread parents)

### 3.2 State Table
```
┌─────────────────────────────────────┐
│            state                    │
├─────────────────────────────────────┤
│ user_id TEXT NOT NULL               │
│ key TEXT NOT NULL                   │
│ value TEXT NOT NULL                 │
│ updated_at INTEGER NOT NULL         │
│ decay_half_life INTEGER NOT NULL    │
│ PRIMARY KEY (user_id, key)          │
└─────────────────────────────────────┘
```

## 4. UserSignalsDO Schema

### 4.1 Signals Table
```
┌─────────────────────────────────────┐
│            signals                   │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ user_id TEXT NOT NULL               │
│ entry_id TEXT NOT NULL              │
│ key TEXT NOT NULL                  │
│ value REAL NOT NULL                 │
│ confidence REAL NOT NULL            │
│ model TEXT NOT NULL                 │
│ version INTEGER NOT NULL DEFAULT 1  │
│ generated_at INTEGER NOT NULL       │
│ expires_at INTEGER                  │
│ trigger_capture_id TEXT             │
│ source_window_days INTEGER          │
│ llm_run_id TEXT                    │
└─────────────────────────────────────┘
```

**Indexes:**
- `idx_signals_user` on (user_id)
- `idx_signals_entry` on (entry_id)
- `idx_signals_trigger` on (trigger_capture_id)
- `idx_signals_version` on (user_id, entry_id, key, version)

**Relationships:**
- `entry_id` → `entries.id` (in UserTimelineDO)
- `trigger_capture_id` → `entries.id` (in UserTimelineDO)

**Signal Keys:**
- `actionability` (0-1)
- `temporal_proximity` (0-1)
- `consequence_strength` (0-1)
- `external_coupling` (0-1)
- `scope_shortness` (0-1)
- `habit_likelihood` (0-1)
- `tone_stress` (0-1)

**Versioning:**
- Each (user_id, entry_id, key) combination has independent versioning
- Latest version query uses MAX(version) with GROUP BY

## 5. UserCommitmentsDO Schema

### 5.1 Commitments Table
```
┌─────────────────────────────────────┐
│         commitments                 │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ user_id TEXT NOT NULL               │
│ origin_entry_id TEXT NOT NULL       │
│ content TEXT NOT NULL               │
│ strength TEXT NOT NULL              │
│ horizon TEXT NOT NULL               │
│ created_at INTEGER NOT NULL         │
│ expires_at INTEGER                  │
│ last_acknowledged_at INTEGER        │
│ version INTEGER NOT NULL DEFAULT 1  │
│ trigger_capture_id TEXT             │
│ source_window_days INTEGER          │
│ status TEXT NOT NULL DEFAULT 'active'│
│ llm_run_id TEXT                    │
└─────────────────────────────────────┘
```

**Indexes:**
- `idx_commitments_user` on (user_id)
- `idx_commitments_trigger` on (trigger_capture_id)
- `idx_commitments_status` on (user_id, status)
- `idx_commitments_version` on (user_id, origin_entry_id, version)

**Relationships:**
- `origin_entry_id` → `entries.id` (in UserTimelineDO)
- `trigger_capture_id` → `entries.id` (in UserTimelineDO)

**Enums:**
- `strength`: 'weak' | 'medium' | 'strong'
- `horizon`: 'short' | 'medium' | 'long'
- `status`: 'active' | 'completed' | 'cancelled'

**Versioning:**
- Versions by (user_id, origin_entry_id)
- Latest version query uses MAX(version) with GROUP BY

## 6. UserTasksDO Schema

### 6.1 Tasks Table
```
┌─────────────────────────────────────┐
│            tasks                    │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ user_id TEXT NOT NULL               │
│ content TEXT NOT NULL               │
│ status TEXT NOT NULL DEFAULT 'pending'│
│ priority TEXT                       │
│ due_date INTEGER                    │
│ version INTEGER NOT NULL DEFAULT 1  │
│ created_at INTEGER NOT NULL         │
│ trigger_capture_id TEXT             │
│ source_window_days INTEGER          │
│ llm_run_id TEXT                    │
└─────────────────────────────────────┘
```

**Indexes:**
- `idx_tasks_user` on (user_id)
- `idx_tasks_status` on (user_id, status)
- `idx_tasks_trigger` on (trigger_capture_id)
- `idx_tasks_version` on (user_id, content, version)

**Relationships:**
- `trigger_capture_id` → `entries.id` (in UserTimelineDO)

**Enums:**
- `status`: 'pending' | 'in_progress' | 'completed' | 'cancelled'
- `priority`: 'low' | 'medium' | 'high'

**Versioning:**
- Versions by (user_id, content)
- Latest version query uses MAX(version) with GROUP BY

## 7. UserFeedDO Schema

### 7.1 Feed Snapshots Table
```
┌─────────────────────────────────────┐
│        feed_snapshots               │
├─────────────────────────────────────┤
│ id (PK) TEXT                        │
│ user_id TEXT NOT NULL               │
│ feed_version INTEGER NOT NULL       │
│ generated_at INTEGER NOT NULL       │
│ items_json TEXT NOT NULL            │
└─────────────────────────────────────┘
```

**Indexes:**
- `idx_feed_user_version` on (user_id, feed_version DESC)
- `idx_feed_user_generated` on (user_id, generated_at DESC)

**Relationships:**
- `user_id` → `user.id` (conceptual, across DOs)

**Feed Item Structure (items_json):**
```typescript
interface FeedItemRendered {
    id: string;
    phrasing: string;
    supporting_note?: string;
    suggested_actions: Array<{ action: string; label: string }>;
}
```

## 8. Complete ERD Diagram

```
┌──────────────┐
│    user      │ (D1 Database)
└──────┬───────┘
       │
       ├─────────────────────────────────────────────┐
       │                                             │
       │                                             │
┌──────▼──────────┐                          ┌──────▼──────────┐
│  UserTimelineDO │                          │ UserSignalsDO  │
│                 │                          │                │
│  ┌──────────┐   │                          │  ┌──────────┐   │
│  │ entries  │   │                          │  │ signals │   │
│  └────┬─────┘   │                          │  └────┬───┘   │
│       │         │                          │        │       │
│  ┌────▼─────┐   │                          │        │       │
│  │  state   │   │                          │        │       │
│  └──────────┘   │                          │        │       │
└─────────────────┘                          └────────┼───────┘
       │                                             │
       │                                             │
       │ (entry_id)                                 │ (entry_id)
       │                                             │
       │                                             │
┌──────▼──────────┐                          ┌──────▼──────────┐
│UserCommitmentsDO│                          │  UserTasksDO    │
│                 │                          │                 │
│  ┌──────────┐   │                          │  ┌──────────┐   │
│  │commitments│   │                          │  │  tasks   │   │
│  └────┬─────┘   │                          │  └──────────┘   │
│       │         │                          │                 │
│       │(origin_│                          │                 │
│       │entry_id)                          │                 │
└───────┼─────────┘                          └─────────────────┘
        │
        │
        │
┌───────▼──────────┐
│ UserFeedDO      │
│                 │
│  ┌──────────┐   │
│  │feed_      │   │
│  │snapshots  │   │
│  └───────────┘   │
└──────────────────┘
```

## 9. Cross-DO Relationships

### 9.1 Conceptual Relationships
- **User → Entries**: One user has many entries (via user_id)
- **Entry → Signals**: One entry can have many signals (via entry_id)
- **Entry → Commitments**: One entry can have many commitments (via origin_entry_id)
- **Entry → Tasks**: Tasks can reference entries (via trigger_capture_id)
- **User → Feed Snapshots**: One user has many feed snapshots (via user_id)

### 9.2 Referential Integrity
- **Within DO**: SQLite foreign keys not enforced (application-level)
- **Across DOs**: No foreign key constraints (conceptual only)
- **Versioning**: All entities support versioning for audit trail

## 10. Data Flow Between Entities

```
User creates Entry
    │
    ▼
UserTimelineDO.entries
    │
    ├──► Triggers SignalsWorkflow
    │         │
    │         ├──► UserSignalsDO.signals (entry_id reference)
    │         ├──► UserCommitmentsDO.commitments (origin_entry_id reference)
    │         └──► UserTasksDO.tasks (trigger_capture_id reference)
    │
    └──► Triggers FeedWorkflow
              │
              └──► UserFeedDO.feed_snapshots (aggregates all above)
```

## 11. Query Patterns

### 11.1 Common Queries

**Get latest signals for entry:**
```sql
SELECT * FROM signals
WHERE user_id = ? AND entry_id = ? AND key = ?
ORDER BY version DESC
LIMIT 1
```

**Get active commitments:**
```sql
SELECT c1.* FROM commitments c1
INNER JOIN (
    SELECT origin_entry_id, MAX(version) as max_version
    FROM commitments
    WHERE user_id = ? AND status = 'active'
    GROUP BY origin_entry_id
) c2 ON c1.origin_entry_id = c2.origin_entry_id 
    AND c1.version = c2.max_version
WHERE c1.user_id = ?
ORDER BY created_at DESC
```

**Get pending tasks:**
```sql
SELECT t1.* FROM tasks t1
INNER JOIN (
    SELECT content, MAX(version) as max_version
    FROM tasks
    WHERE user_id = ? AND status = 'pending'
    GROUP BY content
) t2 ON t1.content = t2.content 
    AND t1.version = t2.max_version
WHERE t1.user_id = ?
ORDER BY created_at DESC
```

**Get current feed:**
```sql
SELECT * FROM feed_snapshots
WHERE user_id = ?
ORDER BY feed_version DESC
LIMIT 1
```

