# DIN Simplification & Merge Plan (Cursor Doc)

> Goal: Reduce architectural complexity, merge Durable Objects where sensible, keep code separation at module boundaries, and ship a stable, understandable system.

---

## 1. First: Define the Core Concepts Clearly

Everything else must revolve around these three layers:

### A. Capture (Timeline)

Raw text. Never edited by AI. Append-only.

### B. Commitments

A *promise you are making to yourself*, derived from captures or explicitly created.

Properties:

* Has intent
* Persists across days/weeks
* Requires acknowledgement or completion

A commitment could be:

* "I want to walk daily"
* "I will finish the tax filing this month"

### C. Tasks

Concrete actions needed to fulfill commitments **or** standalone actions.

Tasks are:

* Time-bound or trigger-based
* Can be completed, snoozed, or cancelled

Example:

* "Book a tax appointment"
* "Walk 20 minutes today"

> Commitments represent direction.
> Tasks represent movement.

---

## 2. Commitment Model (Final Definition)

```
Commitment
id
origin_entry_id
content
strength: weak | medium | strong
horizon: short | medium | long
status: active | completed | cancelled
created_at
expires_at (optional)
last_acknowledged_at
progress_score (0-1)
source_type: ai | user
```

### Rules:

1. Append-only versioning remains.
2. Completing a commitment closes it permanently (new version if revived).
3. Progress changes update `progress_score`, not the core record.
4. Acknowledgement updates `last_acknowledged_at`.

### Commitment Methods

```
createCommitment()
acknowledgeCommitment()
completeCommitment()
cancelCommitment()
updateProgress(score)
listActiveCommitments()
```

---

## 3. Task Model (Final, Behavior-Driven)

Tasks are **scheduled blocks of effort**, created either by the daily planner or reactively from captures. They represent movement toward commitments or one-off actions. All state transitions come from captures.

### 3.1 Structure

```
Task
id
content
commitment_id (optional)
origin_entry_id
planned_date
duration_minutes
preferred_window: morning | afternoon | evening | anytime
task_type: planned | reactive | clarification
status: planned | started | paused | completed | abandoned
created_at
last_event_capture_id
time_spent_minutes
confidence_score
snoozed_until
source_type: ai | user
version
```

### 3.2 Principles

1. No direct manual completion. A capture event moves tasks.
2. Estimates are mandatory. Every task has `duration_minutes`.
3. Time windows guide the planner, not strict calendar blocking.
4. Every event generates a capture.
5. Tasks evolve based on behavior, not just intention.

### 3.3 Lifecycle (Event-Driven)

| Event          | Capture Example             | Transition          |
| -------------- | --------------------------- | ------------------- |
| startTask      | "Started working on X"      | planned → started   |
| pauseTask      | "Taking a break"            | started → paused    |
| resumeTask     | "Back on it"                | paused → started    |
| finishTask     | "Finished the draft"        | started → completed |
| abandonTask    | "Skipping this today"       | any → abandoned     |
| adjustDuration | "This usually takes longer" | estimate updated    |

All of these are stored as captures with `linked_task_id` and typed metadata.

### 3.4 Daily Planner

Runs nightly, producing realistic workload:

* selects commitments with momentum pressure
* balances urgency with capacity
* assigns tasks with duration + preferred window

Output is a daily plan, not a rigid checklist.

---

## 4. Reactive Tasks

When a capture implies action or context, DIN creates tasks instantly.

Example:

> "I did running."

Generated:

* reactive task: "Log details about your run" (2 minutes)
* clarification prompts as micro-tasks

```
clarification fields:
- duration
- distance
- intensity
- optional photo/evidence
```

### 4.1 Clarification Rules

* short-lived
* optional
* expire silently if ignored
* never guilt-inducing

Maximum: **two clarifications per capture** to avoid friction.

---

## 5. Captures as the Source of Truth

DIN derives task and commitment state entirely from captures.

```
Capture
id
text
created_at
linked_task_id (optional)
linked_commitment_id (optional)
event_type (optional)
payload_json
```

Corrections or overrides by the user always win and simply produce new versions. AI cannot rewrite decisions.

---

## 6. Guardrails

* No infinite recurring auto-tasks.
* Semantic dedupe prevents repeated copies of the same intent.
* Planner avoids nag loops and backs off when users ignore prompts.
* Clarifications appear only when they materially improve memory.

---

Next: integrate this model into the merged Durable Object design, simplify workflows, and define migration/deprecation for existing objects.

---

# 7. Unified Architecture (HLD)

## 7.1 Objective

Move from many Durable Objects per user to **one primary UserDO** that owns all user data, while keeping business logic separated into modules. Old DOs remain read-only and are marked deprecated.

## 7.2 New Topology

```
Client
  → Cloudflare Worker (entry)
      → UserDO (single per-user)
          • timeline
          • signals
          • commitments
          • tasks
          • feed snapshots
          • planner state
```

### Why this works

* strong consistency inside one SQLite file
* simpler migrations
* fewer cross-object calls
* lower latency variance
* easier reasoning

Modules stay separated **in code**, not infrastructure.

---

## 8. Unified Schema (LLD)

Tables now live inside the single UserDO database.

* entries
* signals
* commitments
* tasks
* feed_snapshots
* planner_state
* events (derived from captures)

All tables remain append-only with versioning where applicable.

Foreign keys are conceptual only.

---

## 9. Deprecation Strategy (Aggressive)

### 9.1 Policy

We are **starting fresh**. Existing user data and objects are not needed.

* Legacy DOs remain defined because Cloudflare bindings require them.
* Their implementations become **no-op shells**.
* No reads. No writes. No migration. No backfill.
* Existing data is effectively abandoned and will be deleted later at the platform level.

Legacy objects:

* UserTimelineDO (empty)
* UserSignalsDO (empty)
* UserTasksDO (empty)
* UserCommitmentsDO (empty)
* UserFeedDO (empty)

### 9.2 Behavior

1. All traffic writes to **UserDO only**.
2. Any reference to legacy paths returns deterministic empty responses.
3. Code paths referencing legacy modules compile, but contain no logic.
4. The system does not attempt to hydrate from history.

This simplifies rollout and avoids brittle migrations.

### 9.3 Sunset plan

* Phase 1: ship with empty legacy DOs (current)
* Phase 2: feature flags confirm no legacy calls required
* Phase 3: remove bindings in a future breaking release

No compatibility fallback exists by design.

---

## 10. Wrangler Deployment Steps

1. Add new Durable Object binding: USER_DO
2. Keep legacy DO bindings in TOML, but point implementations to stub classes
3. Remove all legacy repository usage from code
4. Route everything through UserDO interfaces
5. Run typecheck, ensure no imports reference old APIs
6. Deploy

Rollback is still possible by redeploying previous build, but we are not preserving data.

---

## 11. Request Routing (Updated)

```
/api/trpc/*
  → context loads UserDO
  → modules operate purely on unified storage
```

Legacy endpoints that previously queried legacy DOs respond with empty payloads.

Workflows reference only capture IDs and UserDO.

---

## 12. Backfill Logic

There is **no backfill**. Users and data are treated as disposable for this reset.

Any request from old users simply starts a new clean dataset.

---

## 13. Failure Modes

* UserDO failure → request retries, then surfaces generic error
* Legacy DO invoked accidentally → returns empty deterministic value
* Build fails → legacy references still exist somewhere, fix by removing import

Nothing blocks capture persistence.

---

## 14. Code Organization

Even with one DO, modules remain isolated:

* /modules/timeline
* /modules/tasks
* /modules/commitments
* /modules/planner
* /modules/feed
* /modules/ai

UserDO exposes small repository-style methods used by these modules.

---

## 15. MVP Cut List

To ship quickly:

* remove historical analytics
* remove habit graphs
* remove feed ranking experiments
* keep only: capture → react → plan → feed

---

## 16. What “Feed” Means

The feed is **the primary guidance surface**. It is not a timeline and not a to‑do list. It is a curated, low‑noise stream showing only what deserves attention *right now*.

Think of it as:

> a daily brief compiled from captures, tasks, and commitments, ranked by relevance and emotional cost, phrased in a calm tone.

### 16.1 What the feed is

* a prioritized set of nudges
* context‑aware suggestions
* reminders tied to actual behavior
* short reflections that improve awareness

### 16.2 What the feed is NOT

* not a full history of actions
* not every task you ever created
* not a guilt or scoreboard system

The feed should feel like a thoughtful assistant quietly guiding, not a dashboard demanding compliance.

---

## 16. Simple Feed Flow (Next 24 Hours Only)

The feed only concerns **the next 24 hours**. Nothing beyond that appears unless it directly sets up tomorrow.

Feed is intentionally minimal.

### 16.1 Inputs

* tasks scheduled for today or overdue from yesterday
* commitments requiring acknowledgement
* captures from the last 48 hours that inform reflection

### 16.2 Steps

1. pull tasks matching the next 24 hours
2. resolve conflicts and dedupe
3. pull commitments that risk fading (low acknowledgement)
4. add at most one gentle reflection based on captures

### 16.3 Output Structure

```
FeedItemRendered {
  id
  phrasing
  supporting_note
  suggested_actions[]
}
```

### 16.4 Rules

* maximum 6 items total
* minimum 1 item if possible (never show an empty void)
* prioritize tasks already planned for today
* add commitments only if they need momentum
* at most one clarification or follow-up question
* refresh feed whenever captures or task state change

This keeps the system calm and predictable.

---

## 16.5 Prioritization Logic

Priority score =

```
(task_time_alignment * 0.45)
+ (importance_from_commitment * 0.30)
+ (effort_vs_energy_match * 0.15)
+ (freshness_of_context * 0.10)
```

Definitions:

* **time alignment**: does this fit the current window (morning/afternoon/evening)
* **importance**: derived from commitment strength and horizon
* **energy match**: avoids suggesting heavy work when user historically fatigued
* **context freshness**: recent captures that make this nudge relevant right now

Ties are resolved by choosing the item with the **lowest emotional friction** first.

---

## 16.6 Phrasing Rules

The feed uses language that is:

* brief
* calm
* non-judgmental
* future‑oriented

### Principles

* never say: "you should" / "you failed"
* prefer: "want to continue?" / "ready to pick this up?"
* avoid countdown guilt
* include context only when it helps decision making

### Examples

**Task nudge**

> "You planned twenty minutes on the thesis. Want to start now?"

**Commitment nudge**

> "You’ve been moving toward finishing the thesis. A small step today would help."

**Reflection**

> "Yesterday looked packed. Anything worth capturing before we move on?"

**Clarification**

> "How long was your run? It helps DIN plan better next time."

Each phrasing comes with 1–2 suggested actions:

* Start
* Snooze
* Skip
* Add detail

---

## 16.7 UI Guidelines

The feed should never feel crowded.

* one card per concept
* generous spacing
* clear primary action
* secondary actions tucked into a subtle menu

### Visual rhythm

* tasks use subtle time indicators
* commitments use softer language and lighter visuals
* reflections are optional and clearly marked

### Interaction rules

* tapping an action implicitly creates a capture
* undo always possible within a short window
* no permanent destructive operations from the feed

The UI should feel closer to **a quiet brief**, not a dashboard.

---

Feed is intentionally minimal.

### 16.1 Inputs

* pending tasks
* active commitments
* recent captures

### 16.2 Steps

1. fetch active tasks ordered by relevance
2. fetch any commitments with low acknowledgement
3. optionally add one reflection prompt from recent captures

### 16.3 Output Structure

```
FeedItemRendered {
  id
  phrasing
  supporting_note
  suggested_actions[]
}
```

### 16.4 Rules

* never overwhelm; max 6 items
* prioritize planned tasks for today
* include at most one clarification prompt
* regenerate only when captures or tasks change

This keeps the system calm and predictable.

---

## 17. Verification Checklist

* build succeeds with no legacy imports
* type checks pass for UserDO-only stores
* captures create reactive tasks
* planner produces tasks with durations
* feed renders simple prioritized list

If all pass, proceed.

---

## 18. Final Notes

This version trades data continuity for reliability and clarity.

Everything routes through one DO.

Legacy objects exist only as stubs until removed in a future breaking change.

---

## 19. Summary

This document is now the authoritative:

* architecture spec
* low-level design
* migration reset plan
* deployment checklist
* feed behavior reference
* deprecation policy guide

Everything here is implementable without fragile compatibility layers.

---

## 20. Next Steps

* scaffold UserDO repository API

* stub legacy DOs

* wire capture → task engine → feed

* run end-to-end smoke test
  . Verification Checklist

* captures persist

* reactive tasks appear instantly

* daily plan generates

* state transitions are capture-driven

* legacy users read correctly

* backfill works silently

If all pass, legacy objects can later be archived.

---

This document now functions as:

* new high-level design
* low-level schema guide
* architecture simplification plan
* migration and backward compatibility manual
* rollout and safety strategy.

---

## 21. FAQ — Tasks, Commitments, Planning, and Flow

### Q1. How are tasks and commitments related?

Commitments express direction. Tasks express motion.

* A task may optionally reference a `commitment_id`.
* Multiple tasks can advance the same commitment.
* Tasks can also exist without a commitment (one‑off items).

DIN never forces a task to have a commitment, but if a consistent pattern emerges, DIN may suggest creating one.

---

### Q2. When does a task attach to a commitment?

Attachment happens at one of three points:

1. **At creation** — planner or AI detects obvious intent.
2. **After the fact** — a later capture clarifies relation.
3. **Manually** — user implies connection in text ("this is for thesis").

Attachment is soft. It can change later through new captures.

---

### Q3. How does progress move from tasks to commitments?

When a task completes through captures:

* small progress increment is applied to `progress_score`
* higher increments occur when multiple related tasks complete
* abandoning repeated tasks slowly decreases progress

Commitments never auto-complete. Closure still requires intent expressed through captures.

---

### Q4. Who wins if task intent and commitment conflict?

User captures always win.

A conflicting capture creates:

* a new task version, or
* a commitment version update

AI may suggest adjustments, but cannot override.

---

### Q5. When are tasks created automatically?

Tasks can appear from:

* nightly planner
* reactive capture interpretation
* clarification follow-ups (temporary)

Reactive creation happens inline, immediately after capture persistence.

---

### Q6. Do tasks ever recur automatically?

Only if:

* user behavior forms a stable pattern, *and*
* DIN proposes recurrence, *and*
* the user implicitly confirms through continued use

No silent infinite recurrence.

---

### Q7. How does snoozing work in this model?

Snoozing adjusts:

* `planned_date`
* `preferred_window`
* friction heuristics internally

Repeated snoozes trigger suggestions to reframe or cancel instead of pushing forward indefinitely.

---

### Q8. How does day planning interact with commitments?

The planner:

1. ranks commitments by momentum, urgency, and emotional cost
2. selects a realistic subset
3. generates tasks with durations and windows

It does not fill the entire day. It prioritizes achievable movement.

---

### Q9. What happens when users ignore clarification prompts?

They expire. No penalty. No guilt.

DIN assumes partial knowledge and moves on.

---

### Q10. How are completion events validated?

A completion requires:

* capture text suggesting closure, *plus*
* time spent that roughly matches estimates, *or*
* a meaningful explanation in capture

If ambiguous, task moves to `review` internally (but still shows as done for the user unless contradicted later).

---

### Q11. What if two tasks describe the same thing?

Semantic dedupe merges them into one active instance and records both origins.

No duplicate nags.

---

### Q12. Can a commitment exist without any tasks?

Yes. Direction may exist without immediate actions. The planner eventually proposes small steps.

---

### Q13. When does DIN ask questions after a capture?

DIN only prompts if:

* missing metadata affects future planning, and
* the user hasn't answered similar prompts recently, and
* a single extra detail materially improves memory

Max two prompts per capture.

---

### Q14. Are tasks ever closed directly?

Never. Closure flows only through captures. Even button actions create an implicit capture entry under the hood.

---

### Q15. How does this stay performant with one DO?

* single-writer consistency
* indexed queries by user/time
* event sourcing via captures keeps writes small

The DO model simplifies correctness without sacrificing scalability at expected usage levels.

---

### Q16. What breaks if we later reintroduce multiple DOs?

Nothing structural. Because modules own logic and DO is storage, sharding can return later without rewriting business rules.

---

### Q17. What if the planner produces unrealistic plans?

DIN tracks:

* planned vs actual time
* abandonment frequency
* snooze patterns

The planner backs off automatically and shifts toward smaller actions.

---

### Q18. What happens after a hard reset of data?

Users simply start fresh. Old DOs hold no logic and no usable state. The unified DO becomes the new system of record.

---

### Q19. How do we test this end-to-end?

Checklist:

1. capture text
2. ensure reactive tasks appear if appropriate
3. trigger nightly planner manually
4. log start/finish via captures
5. confirm feed refresh
6. verify commitment progress moves

If all pass, system is behaving correctly.

---

This FAQ should resolve the conceptual questions that typically surface during development and review, and it anchors how planning, behavior logging, and commitments stay consistent.
