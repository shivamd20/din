# Din – Phase 1 Implementation‑Driven Specification

This document **replaces all previous specs for Phase 1**.

It is written to be **directly implementable** with no interpretation gaps.
If something is not specified here, it does not exist in Phase 1.

---

## 0. Phase 1 Product Definition (Lock This)

Din Phase 1 is a **high‑frequency personal event capture system**.

Users can log:

* Every meal
* Every workout
* Water
* Sleep
* Mood
* Screenshots, photos, PDFs
* Good days and bad days

They can do this **many times a day**, casually, imperfectly, without pressure.

The product must feel like:

> “The fastest place to drop what just happened.”

Not a journal.
Not a chat app.
Not a tracker.

---

## 1. Non‑Negotiable UX Principles

1. Logging must always succeed

2. Logging must always be accepted as complete

3. Logging must never require structure

4. Logging effort must stay constant regardless of frequency

5. The system may ask for clarification, never demand it

6. No numbers, targets, or performance language on the home screen

7. **Offline logging must feel identical to online logging**

8. **Network availability must never block capture**

9. Logging must always succeed

10. Logging must always be accepted as complete

11. Logging must never require structure

12. Logging effort must stay constant regardless of frequency

13. The system may ask for clarification, never demand it

14. No numbers, targets, or performance language on the home screen

---

## 2. App Routes (React + React Router)

```
/        → Home (Log)
/login   → Auth only
```

Nothing else in Phase 1.

---

## 3. Authentication (Complete Flow)

### 3.1 Login Screen (`/login`)

**Purpose**: create trust, not explain features.

UI:

* Centered card
* Calm neutral background

Copy:

* Headline: “A place to put things down.”
* Subtext: “Log what happens. We’ll help you understand it over time.”

Primary action:

* Button: “Continue with Google”

Rules:

* No guest mode
* No feature list
* No onboarding carousel

---

### 3.2 Post‑Login First Use

Immediately redirect to `/`.

Show a **single dismissible overlay** (first session only):

Text:

> “There’s nothing to set up. Just write what happened. One sentence is enough.”

Button:

* “Got it”

Overlay never appears again.

---

### 3.3 Logged‑In State UI

* No persistent header on home
* Avatar icon in top‑right
* Dropdown only contains:

  * Logout

Auth must disappear from the user’s attention.

---

## 4. Home Screen – Continuous Logging

### 4.1 Page Intent

This page exists for **one action only**:

> Capture what just happened.

Everything else is subordinate.

---

### 4.2 Layout Structure

#### A. Input Surface (Primary)

* Single `<textarea>`
* 70–80% viewport height
* Auto‑focus on load
* No label

Placeholder rotates randomly:

* “What happened?”
* “One sentence is enough.”
* “You can be vague.”

Text style:

* Large font
* Comfortable line height

---

#### B. Attachment Row (Secondary)

Located **below** the textarea.

UI:

* Icon buttons only

  * 📷 Image
  * 📎 File

Rules:

* No text labels
* No encouragement copy
* No validation

Attachment behavior:

* Selecting a file immediately shows an inline thumbnail or filename chip
* Multiple attachments allowed
* Attachments are optional and ignorable

---

#### C. Primary Action

Button:

* Label: “Capture”
* Full width
* Fixed near bottom (thumb reachable)

No secondary actions.

---

## 5. Submission & Clarification Flow (Critical)

### 5.1 Offline‑First Capture (Always Happens First)

On clicking Capture:

1. Generate a client‑side `entryId` (UUID)
2. Persist the entry **immediately to local storage** (IndexedDB preferred)
3. UI shows confirmation text:

> “Captured.”

At this point, the task is **complete**.

This must happen even if:

* User is offline
* Network is flaky
* Backend is unreachable

---

### 5.2 Background Sync Queue (Invisible)

All captured entries are enqueued for background sync.

Queue rules:

* FIFO
* Idempotent (client‑generated IDs)
* Silent retries with exponential backoff
* No error UI

Sync triggers:

* Immediately if online
* On network reconnect
* On app open

User is never notified about sync state.

---

### 5.3 Optional Context Completion (Not Chat)

After confirmation, show an **optional context section**.

Header:

> “Want to add more context?”

Up to **4 generated suggestion chips** appear.

If the user responds:

* Context is appended locally to the same `entryId`
* Persisted offline first
* Synced later via `log.append`

After **max 2 context submissions**:

UI responds with:

> “Got it.”

Context section disappears.
Textarea clears.

---

### 5.4 Hard Limits (Anti‑Creep)

* Max 2 follow‑ups per entry
* No looping questions
* No assistant persona
* No advice text

---

### 5.2 Optional Context Completion (Not Chat)

After confirmation, show an **optional context section**.

Header:

> “Want to add more context?”

Below it, up to **4 suggestion chips**.

These are **generated**, not static.

Examples:

* “What did you eat?”
* “When was this?”
* “How did it feel after?”
* “Anything unusual?”

Rules:

* Chips are clickable but not required
* User may ignore completely
* Section can be dismissed

---

### 5.3 Context Completion Interaction

If user clicks a chip or types again:

* Same textarea is reused
* Input is appended to the same event cluster
* Call `log.append`

After **max 2 context submissions**:

UI responds with:

> “Got it.”

Context section disappears.
Textarea clears.

---

### 5.4 Hard Limits (Anti‑Creep)

* Max 2 follow‑ups per entry
* No looping questions
* No assistant persona
* No advice text

---

## 6. Attachment UX (Detailed)

### 6.1 Supported Files

* Images (jpg, png)
* PDFs
* Screenshots

No video in Phase 1.

---

### 6.2 Offline Attachment Handling

If offline:

* Attachments are accepted
* Files are stored temporarily in IndexedDB
* Upload is deferred until connectivity returns

If browser storage limits are exceeded:

* Warn the user *after* capture
* Capture itself still succeeds

Attachments must never block logging.

---

### 6.3 Upload Flow (When Online)

1. Request signed upload URL
2. Upload directly to R2
3. Receive `media_id`
4. Update local entry and enqueue sync update

Failures are retried silently.

---

### 6.2 Upload Flow

1. On file selection, request signed upload URL
2. Upload directly to R2
3. Store `media_id` locally
4. Pass `media_id` with `log.create`

If upload fails:

* Show subtle “Upload failed” inline
* Log submission still proceeds

Attachments must never block logging.

---

## 7. Follow‑Up Generation Rules (Implementation)

Follow‑ups are generated **after initial save**.

### 7.1 Inputs to Generator

* Initial text
* Attachment types
* Recent entry summaries (last few hours only)

---

### 7.2 Generation Constraints

* Max 4 suggestions
* Neutral tone
* Fact‑seeking only
* No “why” questions

Allowed verbs:

* What
* When
* How
* Anything

Disallowed:

* Why
* Should
* Need
* Try

---

### 7.3 Suppression Rules

Do NOT generate follow‑ups if:

* Entry is long and detailed
* User already added 2 contexts today
* Entry is clearly complete (multi‑sentence)

---

## 8. tRPC API Contracts (Mocked, Phase 1)

All APIs must be **idempotent** to support offline‑first sync.
Client generates `entryId`.

### 8.1 `log.create`

```ts
input: {
  entryId: string; // client‑generated UUID
  text: string;
  attachments?: string[]; // media_ids or local placeholders
}

output: {
  entryId: string;
  confirmation: "Captured.";
  followUps?: string[];
}
```

---

```ts
input: {
  text: string;
  attachments?: string[]; // media_ids
}

output: {
  entryId: string;
  confirmation: "Captured.";
  followUps?: string[];
}
```

---

### 8.2 `log.append`

```ts
input: {
  entryId: string;
  text: string;
}

output: {
  ok: true;
}
```

---

## 9. Visual Tone & Safety

* Calm colors
* No gamification
* No streaks
* No red/green states
* No warnings
* No performance language

Every screen must feel safe on a bad day.

---

## 10. Explicitly Out of Scope (Phase 1)

* Chat
* Reflections page
* Goals
* Metrics dashboards
* Notifications
* Coaching

These may only appear in later phases.

---

## 11. Phase 1 Success Criteria

Din Phase 1 succeeds if users:

* Log multiple times per day
* Log small things casually
* Log successfully with no internet
* Never think about sync state
* Do not hesitate before typing
* Feel no guilt when logging inconsistently

If users hesitate, the design failed.

---

Din Phase 1 succeeds if users:

* Log multiple times per day
* Log small things casually
* Do not hesitate before typing
* Feel no guilt when logging inconsistently

If users hesitate, the design failed.

---

## 12. Final Note

This spec is intentionally boring.

That boredom preserves speed, trust, and frequency.

Do not improve it by adding features.
Improve it only by making logging faster.
