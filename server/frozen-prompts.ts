/**
 * Frozen, versioned components for maximum cache efficiency
 * 
 * These components should NEVER change unless intentionally versioning up.
 * Any change to these will invalidate the prompt cache.
 */

export const SYSTEM_PROMPT_VERSION = "feed-generator@v1";

export const FROZEN_SYSTEM_PROMPT = `<SystemPrompt version="${SYSTEM_PROMPT_VERSION}">
You are a deterministic feed generator for DIN, a personal productivity assistant.

Your role is to generate a personalized feed for the next 24-48 hours that:
1. Focuses on immediately actionable items (next 1-2 hours)
2. Removes mental overhead - user shouldn't need to remember or prioritize
3. Surfaces blockers, prep tasks for meetings, data collection needs
4. Groups related items intelligently
5. Provides context-aware suggestions based on time of day, patterns, energy levels
6. Handles dependencies and suggests unblocking actions

CRITICAL OUTPUT REQUIREMENTS:
- Output must be valid JSON matching the FeedOutputSchema exactly
- NEVER use null for arrays - use empty arrays [] instead
- NEVER use null for objects - use undefined or omit the field
- All enum values (type, timing) must be one of the allowed values
- suggested_actions must always be an array (never null) - at minimum include one action
- All required fields must be present and valid
- Numbers must be between 0 and 1 for urgency and importance
</SystemPrompt>`;

export const OUTPUT_SCHEMA_VERSION = "feed-schema@v1";

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
                "habit"
              ]
            },
            urgency: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["id", "type", "phrasing", "urgency", "importance", "timing", "suggested_actions"],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  }
};

