# Din – Follow‑Up UX Microcopy, Suppression Heuristics & Chat Justification Plan

This document is **implementation‑level guidance** for Phase‑1 follow‑ups and Phase‑2 chat introduction.

It exists to prevent accidental drift into pushiness or chat‑first behavior.

---

## 1. Microcopy Variants (Authoritative)

Microcopy must feel:

* Calm
* Optional
* Non‑judgmental
* Finite

Never curious.
Never probing.
Never coaching.

---

### 1.1 Confirmation Copy (After Capture)

Use **one** of the following at random.

Primary set:

* “Captured.”
* “Noted.”
* “Saved.”

Secondary set (used sparingly, <30%):

* “Got it.”
* “All set.”

Rules:

* Period at the end.
* No emojis.
* No praise.

---

### 1.2 Follow‑Up Section Header

Used **only if follow‑ups are shown**.

Variants:

* “If you want, you can add a little more context.”
* “Optional: add more context.”
* “Add more detail if it helps.”

Rules:

* Always include a permission phrase ("if you want", "optional").
* Never ask a question.

---

### 1.3 Suggestion Chip Labels

These are **not questions**.
They are **context handles**.

Allowed base labels:

* “What you ate”
* “Time”
* “How it felt”
* “Anything unusual”
* “Duration”
* “Where”
* “With who”

Formatting:

* Sentence case
* No punctuation

---

### 1.4 Closure Copy (After Max Depth)

Shown when follow‑ups end.

Variants:

* “Got it.”
* “That helps.”
* “All noted.”

Rules:

* Always short
* Always final

---

### 1.5 Error / Edge Messaging (Rare)

Upload failed (after capture):

* “Attachment will upload when you’re back online.”

Sync delayed:

* Never shown inline
* Only visible in timeline as subtle state

---

## 2. Follow‑Up Suppression Heuristics (Precise)

> Follow‑ups are **replies to an entry**, not a conversation.
> They form a short‑lived thread whose sole purpose is clarification.

The system must actively decide **not to ask** most of the time.

---

## 2A. Threading Model (Authoritative)

This section defines how follow‑ups are represented in UI and backend.

### 2A.1 Conceptual Model

* A user submission creates a **root entry**
* Follow‑ups are **replies** to that root
* Replies are linear, shallow, and capped
* This is **not chat**, **not dialogue**, **not exploration**

Think: *email replies to a single message*, not messaging threads.

---

### 2A.2 Data Model Extension

Each entry MUST support threading metadata **and follow-up provenance**:

Each entry MUST support threading metadata:

```ts
Entry {
  entryId: string
  rootId: string        // entryId of the original capture
  parentId?: string    // immediate parent (undefined for root)

  text: string         // user-authored content only

  // Follow-up provenance (only for replies)
  followUp?: {
    chipId: string            // stable id from AI (not label text)
    chipLabel: string         // label shown to user
    generationId: string     // id of AI generation batch
  }

  createdAt: number
  syncStatus: "pending" | "synced"
}
```

Rules:

* Root entry: `rootId = entryId`, `parentId = undefined`
* First follow‑up: `rootId = root.entryId`, `parentId = root.entryId`
* Second follow‑up: `rootId = root.entryId`, `parentId = previous.entryId`

Depth MUST NOT exceed 2.

---

### 2A.3 UI Representation of Replies

When a follow‑up is active, the input UI MUST indicate reply context.

Required UI treatment:

* Above the textarea, show a **quoted context block**
* Text:

  > Replying to:
  > “<root entry text>”

Styling rules:

* Smaller font than main input
* Muted color
* Subtle left border or background
* Collapsible
* Never chat bubbles

This signals *reply*, not *conversation*.

---

### 2A.4 Lifecycle of a Thread

1. Root entry is captured and saved
2. AI generates optional clarification handles with **stable chip IDs**
3. User may click a chip, creating a **reply entry** with follow-up provenance
4. User may reply up to 2 times
5. After depth limit or dismissal:

   * Thread is closed
   * No further follow-ups are generated
   * Thread cannot be reopened later

Threads are **ephemeral interaction scaffolding**, not permanent UI objects.

1. Root entry is captured and saved
2. AI generates optional clarification handles
3. User may reply up to 2 times
4. After depth limit or dismissal:

   * Thread is closed
   * No further follow‑ups are generated
   * Thread cannot be reopened later

Threads are **ephemeral interaction scaffolding**, not permanent UI objects.

---

### 2A.5 Timeline Rendering Rules

In the timeline:

* Root entry appears as a normal item
* Follow‑ups appear **indented beneath the root**
* Indentation is subtle (e.g. 8–12px)
* No connectors, no chat bubbles
* Follow‑ups inherit sync status indicators

The timeline must read as:

> "I logged this, then clarified it"

Not:

> "I had a conversation"

---

Follow‑ups should feel **earned**, not routine.

The system must actively decide **not to ask** most of the time.

---

### 2.1 Global Hard Limits

* Max follow-ups per root entry: **2**
* Max follow-up rounds per day: **6**
* Follow-up provenance is recorded only for replies, never for root entries

Once exceeded:

* Suppress follow-ups for the rest of the day

* Max follow‑ups per root entry: **2**

* Max follow‑up rounds per day: **6**

Once exceeded:

* Suppress follow‑ups for the rest of the day

* Max follow‑ups per entry: **2**

* Max follow‑up rounds per day: **6**

Once exceeded:

* Suppress follow‑ups for the rest of the day

---

### 2.2 Entry‑Level Suppression

Do **not** show follow‑ups if **any** of the following are true:

1. Text length ≥ 280 characters
2. Text contains 3+ factual clauses
3. Text contains time + action already
4. Entry includes both text + attachment
5. Entry is the 5th+ log in last 30 minutes

---

### 2.3 User‑State Suppression

Suppress follow‑ups if:

* User dismissed follow‑ups twice in a row
* User ignored all follow‑ups in last 24 hours
* User logs predominantly single‑word entries

Interpretation:
User prefers speed over depth.
Respect it.

---

### 2.4 Attachment‑Based Suppression

If attachment present:

* Show **at most 1** follow‑up
* Prefer factual prompts only

Example:

* “What this is”
* “When this was taken”

Never ask emotional prompts after attachment.

---

### 2.5 Cool‑Down Logic

If a follow‑up was shown for an entry:

* Do not show follow‑ups for the next **10 minutes**

This prevents conversational creep.

---

## 3. When Chat Becomes Justified (Phase‑2 Plan)

Chat is **not a feature**.
It is a **mode of thinking**.

It must be earned by behavior, not planned by roadmap.

---

### 3.1 Behavioral Preconditions (All Required)

Chat should only be introduced when **all** are true:

1. User logs ≥ 3 times/day on average
2. User has ≥ 14 days of data
3. User frequently writes multi‑sentence entries
4. User has engaged with follow‑ups voluntarily

If any are missing:
Chat will replace logging.

---

### 3.2 Intent Signals (Strong Indicators)

Chat becomes justified when users start:

* Writing questions into the log box
* Writing reflective statements ("I wonder if…")
* Re‑opening old entries repeatedly
* Asking meta questions ("Why does this keep happening")

These signals indicate **meaning‑seeking**, not capture.

---

### 3.3 How Chat Must Be Introduced (Soft)

Never add a chat tab suddenly.

Instead:

1. After a log, occasionally show:

   * “Want to think about this?”
2. Tapping opens a **separate screen**
3. First message is pre‑filled summary, not blank input

This reframes chat as a tool, not a destination.

---

### 3.4 Chat Positioning (Critical)

Chat must be presented as:

* A place to **zoom out**
* A place to **ask about patterns**

Not:

* A place to log
* A place to vent endlessly
* A replacement for capture

---

### 3.5 Permanent Safeguards

Even in Phase‑2:

* Chat never auto‑saves to timeline
* Chat never asks follow‑up questions automatically
* Chat never appears on home
* Chat requires explicit entry

---

## 4. Anti‑Drift Checklist (Use Before Shipping Anything)

Before adding or changing follow‑ups or chat, ask:

1. Does this interrupt capture?
2. Does this increase effort per log?
3. Does this feel like a conversation?
4. Does this introduce obligation?

If **yes** to any → do not ship.

---

## 5. Final Note

Follow‑ups exist to **improve signal quietly**.

Chat exists to **help users think later**.

If you mix these two timelines, the product loses its soul.

This document exists to prevent that.

---

## 6. Implementation Notes (For Engineers)

This section is **normative**. If behavior is ambiguous, defer to these rules.

### 6.1 Follow‑Up Generation Flow (Runtime)

1. User submits root entry
2. Root entry is persisted locally and confirmed to user
3. Follow‑up generation is triggered **async**, never blocking UI
4. AI is given:

   * Root entry text
   * Existing follow‑ups in the thread (if any)
   * Recent root entries (summaries only, last few hours)
5. AI returns a **generation payload**:

```ts
{
  generationId: string,
  chips: {
    chipId: string,
    label: string
  }[]
}
```

Only the `label` is rendered. All metadata stays internal.

---

### 6.2 Chip Click Handling

When a chip is clicked:

1. UI enters **reply mode**
2. Quoted context block is shown (root entry text)
3. User input is captured as a **reply entry**
4. Reply entry is stored with:

   * `rootId`
   * `parentId`
   * `followUp.chipId`
   * `followUp.chipLabel`
   * `followUp.generationId`

If user types without clicking a chip:

* Entry is still a reply
* `followUp` metadata is omitted

---

### 6.3 Thread Closure Logic

A thread is considered **closed** when:

* Max depth (2) is reached
* User dismisses follow‑ups
* Suppression heuristics activate

Once closed:

* No further follow‑up generation is allowed
* UI must not reopen reply mode for that root entry

---

### 6.4 Offline‑First Guarantees

All of the following must work offline:

* Root entry capture
* Follow‑up generation trigger (queued)
* Reply capture
* Thread metadata persistence

AI follow‑up generation may be delayed while offline.
When generation completes later:

* Follow‑ups may appear for **new entries only**
* Never retroactively reopen old threads

---

### 6.5 Timeline Rendering Logic

Timeline rendering rules are deterministic:

* Group entries by `rootId`
* Render root entry first
* Render replies immediately after, indented
* Ordering within a thread is by `createdAt`

Do not collapse or hide replies.
Do not merge text.

---

### 6.6 Things Engineers Must NOT Do

* Do not add assistant prose to the UI
* Do not auto‑reply on behalf of the user
* Do not persist AI text as entries
* Do not reopen closed threads
* Do not treat replies as chat messages

Violating any of these breaks the product contract.

---

### 6.7 Test Cases That Must Pass

Before shipping, verify:

1. Root entry is saved even if follow‑up generation fails
2. Reply can be added offline and synced later
3. Chip metadata survives reloads
4. Timeline shows correct indentation
5. No follow‑ups appear after depth limit

If any fail, fix before adding features.
