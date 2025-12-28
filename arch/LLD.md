# Low-Level Design (LLD) Document

## 1. Component Details

### 1.1 Entry Point (`server/index.ts`)

#### Responsibilities
- HTTP request routing
- Authentication middleware
- Durable Object stub instantiation
- File upload/download handling

#### Key Functions
```typescript
async fetch(request: Request, env: Env): Promise<Response>
```

**Routing Logic:**
- `/api/auth/*` → Auth handler
- `/api/files/*` → File download (authenticated)
- `/api/upload` → File upload (authenticated)
- `/api/chat` → Chat handler
- `/api/trpc/*` → tRPC handler

**Durable Object Instantiation:**
```typescript
const userTimeline = env.USER_TIMELINE_DO.get(
    env.USER_TIMELINE_DO.idFromName(userId)
);
// Similar for other DOs
```

### 1.2 UserTimelineDO

#### Schema
```sql
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    attachments_json TEXT,
    root_id TEXT,
    parent_id TEXT
);

CREATE TABLE state (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    decay_half_life INTEGER NOT NULL,
    PRIMARY KEY(user_id, key)
);
```

#### Key Methods

**`addEntry(userId, text, source, opts?)`**
- Validates input
- Generates UUID if no ID provided
- Checks for existing entry (idempotency)
- Inserts into `entries` table
- Triggers SignalsWorkflow asynchronously
- Returns entry ID

**`getCapturesForWindow(userId, windowDays)`**
- Queries entries within time window
- Returns: `Array<{ id, text, created_at }>`

**`getHome(userId)`**
- Fetches last 50 entries
- Loads state snapshot
- Applies decay to state values
- Scores entries by recency
- Returns top 3 cards

**`getRecentEntries(limit)`**
- Returns most recent entries (default: 20)

### 1.3 UserSignalsDO

#### Schema
```sql
CREATE TABLE signals (
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
```

#### Key Methods

**`addSignal(userId, entryId, key, value, confidence, model, ...)`**
- Calculates next version for (user_id, entry_id, key)
- Inserts new signal record
- Returns signal ID

**`addSignalsBatch(userId, signals[], model, ...)`**
- Batch version of addSignal
- Processes sequentially to maintain version order

**`getSignals(userId, options)`**
- Supports filtering by:
  - `entry_id`
  - `trigger_capture_id`
  - `window_days`
  - `include_history` (if false, returns only latest version)

**Versioning Logic:**
- Latest version query uses subquery with MAX(version)
- Groups by (entry_id, key) for signal uniqueness

### 1.4 UserCommitmentsDO

#### Schema
```sql
CREATE TABLE commitments (
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
```

#### Key Methods

**`addCommitment(userId, originEntryId, content, strength, horizon, ...)`**
- Versions by (user_id, origin_entry_id)
- Strength: 'weak' | 'medium' | 'strong'
- Horizon: 'short' | 'medium' | 'long'
- Status: 'active' | 'completed' | 'cancelled'

**`getCommitments(userId, options)`**
- Filters by status, trigger_capture_id
- `include_history` controls version filtering

### 1.5 UserTasksDO

#### Schema
```sql
CREATE TABLE tasks (
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
```

#### Key Methods

**`addTask(userId, content, status, priority, dueDate, ...)`**
- Versions by (user_id, content)
- Status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
- Priority: 'low' | 'medium' | 'high'

**`getTasks(userId, options)`**
- Filters by status, trigger_capture_id
- `include_history` controls version filtering

### 1.6 UserFeedDO

#### Schema
```sql
CREATE TABLE feed_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feed_version INTEGER NOT NULL,
    generated_at INTEGER NOT NULL,
    items_json TEXT NOT NULL
);
```

#### Key Methods

**`saveFeedSnapshot(userId, version, items)`**
- Stores feed as JSON string
- Auto-increments version

**`getCurrentFeed(userId)`**
- Returns latest feed snapshot
- Parses items_json to FeedItemRendered[]

**`getNextVersion(userId)`**
- Calculates next version number

**`getFeedHistory(userId, limit)`**
- Returns metadata about past feeds

### 1.7 SignalsWorkflow

#### Workflow Steps

1. **fetch-captures**
   - Calls UserTimelineDO.getCapturesForWindow()
   - Returns: `Array<{ id, text, created_at }>`

2. **generate-with-llm**
   - Calls AIService.generateSignalsCommitmentsTasks()
   - Returns: `{ signals, commitments, tasks }`

3. **persist-signals**
   - Calls UserSignalsDO.addSignalsBatch()
   - Includes metadata: model, triggerCaptureId, sourceWindowDays, llmRunId

4. **persist-commitments**
   - Calls UserCommitmentsDO.addCommitmentsBatch()

5. **persist-tasks**
   - Calls UserTasksDO.addTasksBatch()

#### Error Handling
- Each step is retryable via Workflow framework
- Errors are logged and workflow marked as failed

### 1.8 FeedWorkflow

#### Workflow Steps

1. **fetch-tasks**
   - Gets pending/in_progress tasks from UserTasksDO

2. **fetch-commitments**
   - Gets active commitments from UserCommitmentsDO

3. **fetch-signals**
   - Gets recent signals (last 30 days) from UserSignalsDO

4. **build-candidates**
   - Calls `buildCandidates(tasks, commitments, signals)`
   - Returns: `FeedItem[]`

5. **score-and-rank**
   - Calls `scoreItems(candidates, currentTime)`
   - Calls `rankItems(scored)`
   - Returns: `FeedItem[]` (ranked)

6. **phrase-items**
   - Calls `phraseFeedItems(rankedItems, currentTime, env)`
   - Returns: `FeedItemRendered[]`

7. **persist-feed**
   - Calls UserFeedDO.saveFeedSnapshot()
   - Saves versioned feed

### 1.9 Feed Generator (`feed-generator.ts`)

#### Functions

**`buildCandidates(tasks, commitments, signals)`**
- Transforms tasks into FeedItems:
  - Calculates urgency from due_date
  - Maps priority to importance
  - Determines time_context from current time
- Transforms commitments into FeedItems:
  - Maps strength → importance
  - Maps horizon → urgency/timing
- Transforms signals into FeedItems:
  - Groups by entry_id
  - Creates reminders from actionability signals
  - Creates habits from habit_likelihood signals

**`scoreItems(items, currentTime)`**
- Calculates time alignment (0-1)
- Final score: `(urgency * 0.5) + (importance * 0.4) + (timeAlignment * 0.1)`

**`rankItems(items)`**
- Sorts by score (descending)
- Removes score field from output

### 1.10 Feed Phrasing (`feed-phrasing.ts`)

#### Function

**`phraseFeedItems(items, currentTime, userContext, env)`**
- Uses TanStack AI with Gemini adapter
- System prompt: Empathetic, concise, time-aware tone
- User prompt: Includes current time, user context, feed items
- Output schema: `FeedPhrasingOutputSchema`
- Validation:
  - Ensures all input IDs have corresponding output
  - Verifies order matches
  - Falls back to `createFallbackPhrasing()` on failure

**Fallback Logic:**
- Maps action types to default labels
- Generates simple phrasing from item description

### 1.11 AI Service (`ai-service.ts`)

#### Methods

**`extractSignals(text)`**
- Single text extraction
- Returns: `Signals` (7 signal values)

**`generateSignalsCommitmentsTasks(captures, windowDays)`**
- Formats captures chronologically
- Calls LLM with structured prompt
- Returns: `{ signals, commitments, tasks }`
- Retry logic: One retry on failure

#### Prompt Structure
```
You are analyzing user captures from the past {windowDays} days.
Given the following captures in chronological order:
[Capture 1 - ID: ... - Date: ...]
{text}
...
Generate:
1. Signals: Extract signal values for each capture entry_id
2. Commitments: Identify commitments linked to origin_entry_id
3. Tasks: Extract actionable tasks with priorities and due dates
```

### 1.12 AI Model (`ai-model.ts`)

#### Configuration
- **Models**: `gemini-2.0-flash`, `gemini-2.5-flash`
- **Default**: `gemini-2.0-flash`
- **Mock Mode**: Always enabled (for offline development)

#### Methods

**`getAdapter(modelId?)`**
- Returns mock adapter if `useMock === true`
- Otherwise returns Gemini adapter with API key

**`extractSignals(text)`**
- Uses structured output schema
- Returns default values on error

**`streamChat(messages, tools?, modelId?)`**
- Converts messages to TanStack format
- Prepends system prompt
- Returns chat stream

### 1.13 tRPC Router (`trpc.ts`)

#### Procedures

**`entries.mutate`**
- Input: `{ text, source }`
- Calls: `userTimeline.addEntry()`
- Returns: `{ entry_id }`

**`home.query`**
- Calls: `userTimeline.getHome()`
- Returns: Home data with cards and state

**`log.create`** (Legacy compatibility)
- Maps legacy input to `addEntry` options
- Returns legacy format

**`signals.list`**
- Input: `{ entry_id?, trigger_capture_id?, include_history?, window_days? }`
- Calls: `userSignals.getSignals()`

**`commitments.list`**
- Input: `{ status?, include_history?, trigger_capture_id? }`
- Calls: `userCommitments.getCommitments()`

**`tasks.list`**
- Input: `{ status?, include_history?, trigger_capture_id? }`
- Calls: `userTasks.getTasks()`

**`signalsGenerate.mutation`**
- Triggers SignalsWorkflow
- Returns: `{ success: true }`

**`feed.getCurrent`**
- Calls: `userFeed.getCurrentFeed()`
- Returns: `FeedItemRendered[]`

**`feed.refresh`**
- Triggers FeedWorkflow
- Returns: `{ success: true }`

**`feed.getHistory`**
- Calls: `userFeed.getFeedHistory()`
- Returns: Feed history metadata

## 2. Data Flow Details

### 2.1 Entry Creation Flow

```
1. Client sends tRPC request: entries.mutate({ text, source })
2. index.ts routes to tRPC handler
3. tRPC creates Context with DO stubs
4. trpc.ts calls ctx.userTimeline.addEntry()
5. UserTimelineDO.addEntry():
   a. Validates and generates ID
   b. Inserts into entries table
   c. Triggers SignalsWorkflow (async, non-blocking)
6. Returns entry_id to client
7. SignalsWorkflow runs in background:
   a. Fetches captures
   b. Calls AIService
   c. Persists signals/commitments/tasks
   d. Triggers FeedWorkflow
8. FeedWorkflow runs:
   a. Fetches tasks/commitments/signals
   b. Builds candidates
   c. Scores and ranks
   d. Phrases with LLM
   e. Saves feed snapshot
```

### 2.2 Feed Retrieval Flow

```
1. Client sends tRPC request: feed.getCurrent
2. tRPC calls ctx.userFeed.fetch()
3. UserFeedDO.getCurrentFeed():
   a. Queries latest feed_snapshot
   b. Parses items_json
   c. Returns FeedItemRendered[]
4. Client receives feed items
```

## 3. Error Handling

### 3.1 Workflow Errors
- Each workflow step is wrapped in try-catch
- Errors are logged with context
- Workflow marked as failed (retryable)

### 3.2 LLM Errors
- AIService has retry logic (one retry)
- FeedPhrasing has retry logic (one retry)
- Fallback responses on failure

### 3.3 Database Errors
- SQLite errors bubble up
- No explicit transaction handling (DOs provide isolation)

### 3.4 Validation Errors
- Zod schemas validate inputs
- tRPC returns validation errors to client

## 4. Performance Considerations

### 4.1 Database Queries
- Indexes on frequently queried columns:
  - `entries(user_id, created_at DESC)`
  - `signals(user_id, entry_id, key, version)`
  - `commitments(user_id, status)`
  - `tasks(user_id, status)`
  - `feed_snapshots(user_id, feed_version DESC)`

### 4.2 Caching
- Feed snapshots reduce computation
- No explicit caching layer (DOs provide in-memory state)

### 4.3 Async Processing
- Workflows run asynchronously
- User requests don't wait for processing

## 5. Testing Considerations

### 5.1 Test Mode
- `X-Test-Mode: true` header bypasses auth
- `X-Test-User-Id` header sets test user

### 5.2 Mock Adapter
- Always enabled for offline development
- Returns deterministic responses

### 5.3 Integration Tests
- Located in `tests/integration/`
- Test workflows, versioning, signals

