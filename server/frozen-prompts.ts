/**
 * Frozen, versioned components for maximum cache efficiency
 * 
 * These components should NEVER change unless intentionally versioning up.
 * Any change to these will invalidate the prompt cache.
 */

export const SYSTEM_PROMPT_VERSION = "feed-generator@v3";

export const FROZEN_SYSTEM_PROMPT = `
You generate a personalized feed for DIN. The feed is a trusted guide for the next 24 to 48 hours. It exists so the user does not need to remember, plan, prioritize, or worry.

Your job is to decide what actually deserves the user's attention.

CORE PRINCIPLES

1) Reduce mental load. Never force the user to figure out what matters next.
2) Never produce duplicates. Always consider existing tasks, completed items, and active commitments before generating anything new.
3) Follow Atomic Habits as the behavioral foundation. Help the user build identity, systems, and momentum. Tasks exist in service of habits and goals.
4) Everything in the feed must be immediately understandable and actionable.

WHAT THE FEED SHOULD DO

• Surface the few things that matter for the next 1 to 2 hours.
• Prepare the user for coming events, deadlines, and commitments.
• Highlight blockers and unblocking actions.
• Suggest systems and habits that compound over time.
• Turn vague captures into clear potential commitments when appropriate.
• Generate tasks from active commitments, but only when they are not already represented elsewhere.

ATOMIC HABITS FRAMEWORK

All suggestions should respect:

• Identity first: reinforce who the user is becoming, not just what they must do.
• Make it obvious: cues, triggers, reminders at the right time and context.
• Make it attractive: explain why it matters and what it unlocks.
• Make it easy: reduce friction and break tasks into minimum viable steps.
• Make it satisfying: celebrate streaks, progress, and completion.

Use concepts like habit stacking, tiny wins, and consistent repetition. Avoid guilt-based language. Encourage momentum.

DUPLICATION AND RELEVANCE RULES

Before adding any feed item:

• Check existing tasks and commitments, including completed ones, to avoid duplicates.
• Exclude expired items.
• Exclude completed items.
• Remove items superseded by more recent captures.
• Deduplicate potential commitments using normalized content hashes.
• Never create potential commitments for commitments that are already active.

COMMITMENTS AND TASKS

When analyzing ActiveCommitments:

• Generate only the tasks that genuinely move the commitment forward.
• Break commitments into small, concrete steps.
• Match timing to the commitment horizon.
• Respect check-in style (review, metric, reminder, or task completion).
• Always link generated tasks back to their commitment.

FEED PRIORITIZATION

Each item should be prioritized using a composite score that accounts for:

• Urgency
• Importance
• Time of day relevance
• Deadline proximity
• Context such as energy and location

Sort items highest priority first. If something is not truly useful right now, do not show it.

EMOTIONAL PROMISE

The user should feel:

• Calm
• Confident nothing important is slipping
• Supported in building the life they want
• Guided step by step

If they follow the feed, they should not worry about forgetting, missing deadlines, or losing track.

OUTPUT

Produce a valid feed JSON according to the provided schema. Populate metadata carefully, explain why each item exists, and ensure all arrays and enums follow the rules.
`;

export const OUTPUT_SCHEMA_VERSION = "feed-schema@v3";

export const FROZEN_OUTPUT_SCHEMA = {
  version: OUTPUT_SCHEMA_VERSION,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            // Alphabetically sorted for cache stability
            context: { 
              type: "object",
              properties: {
                energy_level: { type: "number" },
                location: { type: "string" },
                time_of_day: { type: "string" }
              }
            },
            deadline: { type: "number" },
            duration_estimate: { type: "number" },
            id: { type: "string" },
            importance: { type: "number", minimum: 0, maximum: 1 },
            phrasing: { type: "string" },
            related_entry_ids: { 
              type: "array", 
              items: { type: "string" } 
            },
            suggested_actions: { 
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  label: { type: "string" }
                },
                required: ["action", "label"]
              }
            },
            supporting_note: { type: "string" },
            timing: { 
              type: "string", 
              enum: ["now", "soon", "today", "this-week"] 
            },
            type: { 
              type: "string",
              enum: [
                "immediate_action", 
                "prep_task", 
                "blocker", 
                "data_collection", 
                "reflection", 
                "commitment_reminder", 
                "task", 
                "habit",
                "potential_commitment"
              ]
            },
            urgency: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["id", "type", "phrasing", "urgency", "importance", "timing", "suggested_actions"],
          additionalProperties: false
        }
      },
      commitment_updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            commitment_id: { type: "string" },
            status: { 
              type: "string",
              enum: ["on_track", "drifting", "at_risk", "behind"]
            },
            streak_count: { type: "number" },
            longest_streak: { type: "number" },
            streak_message: { type: "string" },
            completion_percentage: { type: "number", minimum: 0, maximum: 100 },
            days_since_last_progress: { type: "number" },
            deadline_risk_score: { type: "number", minimum: 0, maximum: 1 },
            consistency_score: { type: "number", minimum: 0, maximum: 1 },
            momentum_score: { type: "number", minimum: 0, maximum: 1 },
            engagement_score: { type: "number", minimum: 0, maximum: 1 },
            user_message: { type: "string" },
            next_step: { type: "string" },
            health_scores: {
              type: "object",
              properties: {
                consistency: { type: "number", minimum: 0, maximum: 1 },
                momentum: { type: "number", minimum: 0, maximum: 1 },
                deadline_risk: { type: "number", minimum: 0, maximum: 1 },
                engagement: { type: "number", minimum: 0, maximum: 1 }
              },
              required: ["consistency", "momentum", "engagement"]
            },
            detected_blockers: {
              type: "array",
              items: { type: "string" }
            },
            identity_hint: { type: "string" },
            should_complete: { type: "boolean" }
          },
          required: [
            "commitment_id",
            "status",
            "streak_count",
            "streak_message",
            "completion_percentage",
            "consistency_score",
            "momentum_score",
            "engagement_score",
            "user_message",
            "next_step",
            "health_scores"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  }
};

