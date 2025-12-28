# High-Level Design (HLD) Document

## 1. System Overview

### 1.1 Purpose
DIN is a personal productivity assistant built on Cloudflare Workers that helps users capture thoughts, extract signals, generate commitments and tasks, and present a personalized feed of actionable items.

### 1.2 Architecture Pattern
- **Platform**: Cloudflare Workers with Durable Objects
- **Architecture Style**: Event-driven, microservices-like with Durable Objects
- **Data Storage**: SQLite within Durable Objects (per-user isolation)
- **API**: tRPC for type-safe RPC calls
- **AI Integration**: TanStack AI with Gemini models (with mock adapter support)

### 1.3 Key Principles
- **Append-only**: All data modifications are append-only (versioned)
- **Per-user isolation**: Each user has dedicated Durable Objects
- **Event-driven processing**: Background workflows process captures asynchronously
- **Type safety**: Full TypeScript with tRPC for end-to-end type safety

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                        │
│                    (Entry Point)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │  Auth   │   │  tRPC   │   │  Chat   │
   │ Handler │   │ Router  │   │ Handler │
   └─────────┘   └────┬────┘   └─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼─────┐  ┌───▼────┐  ┌────▼─────┐
   │ Timeline │  │Signals │  │ Feed     │
   │    DO    │  │   DO   │  │   DO     │
   └──────────┘  └────────┘  └──────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼─────┐  ┌───▼────┐  ┌────▼─────┐
   │Commitment│  │ Tasks  │  │ Workflows│
   │    DO    │  │   DO   │  │          │
   └──────────┘  └────────┘  └──────────┘
```

### 2.2 Component Responsibilities

#### 2.2.1 Entry Point (`index.ts`)
- Routes HTTP requests to appropriate handlers
- Manages authentication
- Instantiates Durable Object stubs
- Handles file uploads/downloads

#### 2.2.2 Durable Objects (DOs)
Each DO manages per-user state and data:

- **UserTimelineDO**: Stores user captures/entries
- **UserSignalsDO**: Stores extracted signals (actionability, temporal_proximity, etc.)
- **UserCommitmentsDO**: Stores user commitments with strength/horizon
- **UserTasksDO**: Stores tasks with priority and due dates
- **UserFeedDO**: Stores generated feed snapshots

#### 2.2.3 Workflows
- **SignalsWorkflow**: Processes captures → generates signals/commitments/tasks
- **FeedWorkflow**: Aggregates tasks/commitments/signals → generates feed

#### 2.2.4 Services
- **AIService**: LLM integration for signal extraction and generation
- **FeedGenerator**: Pure functions for building, scoring, ranking feed items
- **FeedPhrasing**: LLM-based phrasing of feed items for user presentation

## 3. Data Model

### 3.1 Core Entities

1. **User** (from auth schema)
   - id, name, email, image, createdAt, updatedAt, isAnonymous

2. **Entry** (Timeline)
   - id, user_id, text, created_at, source, attachments_json, root_id, parent_id

3. **Signal**
   - id, user_id, entry_id, key, value, confidence, model, version, generated_at, expires_at, trigger_capture_id, source_window_days, llm_run_id

4. **Commitment**
   - id, user_id, origin_entry_id, content, strength, horizon, created_at, expires_at, last_acknowledged_at, version, trigger_capture_id, source_window_days, status, llm_run_id

5. **Task**
   - id, user_id, content, status, priority, due_date, version, created_at, trigger_capture_id, source_window_days, llm_run_id

6. **Feed Snapshot**
   - id, user_id, feed_version, generated_at, items_json

### 3.2 Relationships

- User → Entries (1:N)
- Entry → Signals (1:N)
- Entry → Commitments (1:N, via origin_entry_id)
- User → Tasks (1:N)
- User → Feed Snapshots (1:N)

## 4. Request Flow

### 4.1 Capture Entry Flow
```
Client → tRPC entries.mutate
  → UserTimelineDO.addEntry()
    → Insert entry into SQLite
    → Trigger SignalsWorkflow (async)
      → SignalsWorkflow.run()
        → Fetch captures from UserTimelineDO
        → AIService.generateSignalsCommitmentsTasks()
        → Persist to UserSignalsDO, UserCommitmentsDO, UserTasksDO
        → Trigger FeedWorkflow (async)
          → FeedWorkflow.run()
            → Fetch tasks, commitments, signals
            → buildCandidates()
            → scoreItems() + rankItems()
            → phraseFeedItems()
            → Persist to UserFeedDO
```

### 4.2 Feed Retrieval Flow
```
Client → tRPC feed.getCurrent
  → UserFeedDO.getCurrentFeed()
    → Query latest feed_snapshot
    → Return FeedItemRendered[]
```

## 5. Key Design Decisions

### 5.1 Durable Objects for Per-User Isolation
- Each user gets dedicated DO instances
- Natural sharding and isolation
- Strong consistency within user's data

### 5.2 Append-Only Versioning
- All entities support versioning
- Enables audit trail and time-travel queries
- Supports `include_history` flag for historical data

### 5.3 Workflow-Based Processing
- Asynchronous processing via Cloudflare Workflows
- Retryable and observable
- Non-blocking user requests

### 5.4 Type-Safe API with tRPC
- End-to-end type safety
- Automatic client code generation
- Runtime validation with Zod

## 6. External Dependencies

- **Cloudflare Workers**: Runtime platform
- **Durable Objects**: Per-user state management
- **Workflows**: Async processing orchestration
- **TanStack AI**: LLM integration framework
- **Gemini API**: LLM provider (with mock fallback)
- **Better Auth**: Authentication provider
- **Drizzle ORM**: Database abstraction

## 7. Scalability Considerations

- **Horizontal**: Durable Objects automatically scale per user
- **Vertical**: Workflows handle async processing independently
- **Caching**: Feed snapshots reduce computation on reads
- **Rate Limiting**: Can be added at Worker level

## 8. Security Considerations

- **Authentication**: Better Auth with anonymous support
- **Authorization**: Per-user DO isolation ensures data access control
- **API Keys**: Stored in environment variables
- **Input Validation**: Zod schemas validate all inputs

