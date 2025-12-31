import type { Entry } from './db/daos/EntryDAO';
import type { Task, Commitment } from './db/daos';
import { canonicalizePrompt, canonicalizeEntries } from './prompt-canonicalizer';
import { FROZEN_SYSTEM_PROMPT, FROZEN_OUTPUT_SCHEMA, OUTPUT_SCHEMA_VERSION } from './frozen-prompts';

export interface PromptStructure {
  prefix: string; // Frozen (cached by provider)
  suffix: string; // Variable (processed each time)
  last_processed_entry_id: string;
  prefix_token_count: number; // Estimated
  suffix_token_count: number; // Estimated
}

export interface EntityContext {
  tasks?: Task[];
  commitments?: Commitment[];
  timeOfDay?: string;
  energyLevel?: number;
  location?: string;
}

/**
 * Build prompt with 70-90% frozen prefix + 10-30% variable suffix
 * Includes tasks, commitments, and context for LLM linking
 */
export function buildPrompt(
  allEntries: Entry[],
  lastProcessedEntryId: string | null,
  currentTime: number,
  entityContext?: EntityContext
): PromptStructure {
  // Split entries
  const prefixEntries = lastProcessedEntryId
    ? allEntries.filter(e => e.id <= lastProcessedEntryId)
    : [];
  const suffixEntries = lastProcessedEntryId
    ? allEntries.filter(e => e.id > lastProcessedEntryId)
    : allEntries;
  
  // Build frozen prefix
  const canonicalizedPrefixEntries = canonicalizeEntries(prefixEntries);
  const prefix = [
    FROZEN_SYSTEM_PROMPT,
    `\n<OutputSchema version="${OUTPUT_SCHEMA_VERSION}">\n${JSON.stringify(FROZEN_OUTPUT_SCHEMA, null, 0)}\n</OutputSchema>`,
    `\n<HistoricalEntries count="${prefixEntries.length}">\n${canonicalizedPrefixEntries}\n</HistoricalEntries>`
  ].join('\n\n');
  
  // Build variable suffix
  const canonicalizedSuffixEntries = canonicalizeEntries(suffixEntries);
  
  // Build entity context section for LLM linking
  const entitySections: string[] = [];
  
  if (entityContext?.tasks && entityContext.tasks.length > 0) {
    const tasksJson = JSON.stringify(entityContext.tasks.map(t => ({
      id: t.id,
      content: t.content,
      status: t.status,
      planned_date: t.planned_date,
      created_at: t.created_at,
      commitment_id: t.commitment_id
    })), null, 0);
    entitySections.push(`<ActiveTasks count="${entityContext.tasks.length}">\n${tasksJson}\n</ActiveTasks>`);
  }
  
  if (entityContext?.commitments && entityContext.commitments.length > 0) {
    // Filter to only active commitments (for task generation)
    const activeCommitments = entityContext.commitments.filter(c => 
      c.status === 'active' || c.status === 'confirmed'
    );
    
    if (activeCommitments.length > 0) {
      const commitmentsJson = JSON.stringify(activeCommitments.map(c => ({
        id: c.id,
        content: c.content,
        status: c.status,
        strength: c.strength,
        horizon: c.horizon,
        created_at: c.created_at,
        // Include structured time horizon fields for task generation
        time_horizon_type: c.time_horizon_type,
        time_horizon_value: c.time_horizon_value,
        cadence_days: c.cadence_days,
        check_in_method: c.check_in_method,
        expires_at: c.expires_at
      })), null, 0);
      entitySections.push(`<ActiveCommitments count="${activeCommitments.length}">\n${commitmentsJson}\n</ActiveCommitments>`);
    }
  }
  
  // Build context section
  const contextParts: string[] = [
    `current_time=${currentTime}`,
    `current_date=${new Date(currentTime).toISOString().split('T')[0]}`,
    `current_hour=${new Date(currentTime).getHours()}`
  ];
  
  if (entityContext?.timeOfDay) {
    contextParts.push(`time_of_day=${entityContext.timeOfDay}`);
  }
  if (entityContext?.energyLevel !== undefined) {
    contextParts.push(`energy_level=${entityContext.energyLevel}`);
  }
  if (entityContext?.location) {
    contextParts.push(`location=${entityContext.location}`);
  }
  
  // Include completed tasks in last 2 hours for recent activity suppression
  const twoHoursAgo = currentTime - (2 * 60 * 60 * 1000);
  const completedTasksInfo = entityContext?.tasks 
    ? entityContext.tasks
        .filter(t => t.status === 'completed' && t.created_at >= twoHoursAgo)
        .map(t => ({
          id: t.id,
          content: t.content,
          status: t.status,
          created_at: t.created_at,
          commitment_id: t.commitment_id
        }))
    : [];
  
  const completedTasksSection = completedTasksInfo.length > 0
    ? `<CompletedTasks count="${completedTasksInfo.length}">\n${JSON.stringify(completedTasksInfo, null, 0)}\n</CompletedTasks>`
    : '';

  const suffix = [
    `<NewEntries count="${suffixEntries.length}">\n${canonicalizedSuffixEntries}\n</NewEntries>`,
    ...entitySections,
    completedTasksSection,
    `\n<CurrentContext>\n${contextParts.join('\n')}\n</CurrentContext>`,
    `\nGenerate the feed now. Use the provided tasks and commitments to link feed items appropriately via related_task_id and related_commitment_id.

CRITICAL INSTRUCTIONS:

1. POTENTIAL COMMITMENTS: Analyze new entries for potential commitments. Detect statements like "I'll do it", "I will", "Remind me", "We should finish this", "I'll get back to you". Generate potential_commitment items with deduplication_key. NEVER generate potential_commitment for commitments already in ActiveCommitments.

2. TASK GENERATION FROM COMMITMENTS: For each ActiveCommitment:
   - If time_horizon_type="date": Generate tasks leading up to deadline (e.g., "Draft outline", "Complete analysis", "Final review")
   - If time_horizon_type="daily": Generate daily recurring tasks
   - If time_horizon_type="weekly": Generate weekly recurring tasks  
   - If time_horizon_type="monthly": Generate monthly recurring tasks
   - If time_horizon_type="continuous"/"maintain": Generate maintenance tasks
   - If check_in_method="task_completion": Generate specific actionable tasks
   - Break down commitment content into smaller actionable steps
   - Set related_commitment_id on all generated tasks

3. DEDUPLICATION ALGORITHM (check in this order before generating any task):
   a) Commitment reference check: If generating a task for a commitment, check if a task with related_commitment_id matching that commitment already exists in ActiveTasks. If yes, DO NOT generate a duplicate.
   b) Exact content match: Check if exact task content already exists in ActiveTasks (case-insensitive, normalized). If yes, DO NOT generate a duplicate.
   c) Semantic similarity: For independent tasks (not linked to commitments), check if semantically similar task exists (70%+ similarity threshold). If yes, DO NOT generate a duplicate.
   d) Potential commitments: Use deduplication_key (hash of normalized commitment content) to prevent duplicate potential commitments.

4. SUPPRESSION RULES (do not generate items that should be suppressed):
   a) Time-based suppression: 
      - Suppress evening tasks (after 5pm) in morning (before 12pm)
      - Suppress morning tasks (before 12pm) in evening (after 5pm)
   b) Energy-based suppression: 
      - Suppress high-energy tasks (urgency > 0.7) when energy_level < 0.4
   c) Recent activity suppression: 
      - Suppress if user completed similar task in last 2 hours (check CompletedTasks for tasks completed within 2 hours)
      - Check task content similarity to avoid showing same type of task immediately after completion
   d) Overwhelm detection: 
      - If generating >5 items, suppress items with priority_score < 0.5
      - Prioritize showing only the most important items (max 5-7 items total)

5. HABIT TAXONOMY (use when generating habit-related feed items):
   a) Daily (identity-building): "I am someone who..." - Reinforce identity through daily actions. Focus on who the user is becoming, not just what they must do.
   b) Weekly (systems): Build routines and processes that compound over time. Focus on systems that create momentum.
   c) Monthly (goals): Track progress toward larger objectives. Connect daily actions to monthly outcomes.
   d) Maintenance (health): Physical and mental well-being habits. Focus on sustaining health and energy.
   e) Growth (learning): Skill development and knowledge acquisition. Focus on continuous improvement and learning.

6. IDENTITY COMMUNICATION (phrasing guidelines):
   - Use identity-first phrasing: "You're someone who..." instead of "You should..."
   - Celebrate progress in supporting_note: Show streaks, wins, momentum
   - Subtle encouragement: Frame tasks as identity reinforcement, not obligations
   - Avoid guilt-based language: Focus on momentum and systems, not failures
   - Make it satisfying: Celebrate streaks, progress, and completion in phrasing

7. OUTPUT REQUIREMENTS:
   - All items must have generation_reason explaining why they exist
   - Sort items by priority_score (highest first)
   - Only include items that pass all filtering and suppression rules
   - Ensure all metadata fields are populated correctly

8. COMMITMENT STATUS ANALYSIS: For each ActiveCommitment (status='active' or 'confirmed'):
   - Analyze all tasks linked to the commitment (completed + active)
   - Analyze related entries/captures for context
   - Compute metrics:
     * Current streak: consecutive days/weeks with meaningful progress (allow grace period of 1-2 days)
     * Longest streak: historical maximum
     * Completion percentage: tasks completed / expected based on time_horizon_type and cadence
     * Days since last progress: recency of last task completion or acknowledgment
     * Deadline risk: proximity to deadline if time_horizon_type="date"
     * Consistency score: how regular the pattern is (0-1)
     * Momentum score: recent activity vs historical average (0-1)
     * Engagement score: frequency of acknowledgments/check-ins (0-1)
   
   - DETECT COMPLETION: Check if commitment goal has been achieved:
     * Look for completion language in recent entries: "I finished...", "Done with...", "Achieved...", "Completed...", "Finished..."
     * Check if completion_percentage >= 100% or all related tasks are completed
     * Check if deadline passed with high completion percentage (>= 90%)
     * Check if commitment goal is explicitly stated as achieved in captures
     * If completion detected, set should_complete: true in commitment_updates
   
   - Determine status using LLM judgment:
     * "on_track": Meeting cadence, good momentum, low risk
     * "drifting": Missing occasional days but recoverable
     * "at_risk": Pattern of misses, deadline approaching, momentum declining
     * "behind": Significantly off track, high deadline risk
   
   - Generate personalized user_message (context-dependent):
     * Encouraging/celebratory when doing well ("You're on a 7-day streak!")
     * Supportive but direct when struggling ("You've missed 2 days. Start again today.")
     * Action-oriented (always suggest next step)
     * Identity-focused ("You're becoming someone who finishes things")
   
   - Generate next_step:
     * First, reference existing incomplete tasks linked to commitment
     * If none exist, suggest breaking commitment into smaller actionable step
     * Can be check-in/reflection if appropriate
   
   - Detect blockers (combination approach):
     * Analyze task patterns: repeatedly snoozed, abandoned tasks
     * Infer from gaps: no progress = likely blocker
     * Categorical blockers: "unclear next step", "lost motivation", "waiting on someone", "too big/overwhelming"
     * Specific blockers if detectable from entries: "waiting on John"
   
   - Generate identity_hint: "You're someone who honors deadlines" or "You're becoming a consistent writer"
   
   - Include all metrics in commitment_updates array, including should_complete: true if completion detected

9. ACTION CONTEXT ANALYSIS: When processing entries with action_context:
   - action_context contains rich metadata about user actions on feed items
   - Use this to understand:
     * What action the user took (start, done, snooze, skip, renegotiate, etc.)
     * Which feed item/card was acted upon (feed_item_id)
     * Related commitment or task (linked_commitment_id, linked_task_id)
     * Original card content and generation reason
     * Card type, priority score, expiration
     * User's additional context in the entry text
   - This helps you:
     * Avoid regenerating items that were just acted upon (check feed_item_id in action_context)
     * Understand user preferences and patterns (what they skip, what they complete quickly)
     * Generate better follow-up items based on action outcomes
     * Track commitment progress accurately (use action_context.commitment_content and related fields)
     * Respect user decisions (if they skipped something, don't immediately regenerate it)
     * Learn from renegotiations (action_context contains what changed about commitments)
   - When you see action_context with feed_item_id, that feed item should NOT appear in the next feed generation
   - Use action_context.generation_reason to understand why the original item was shown
   - Use action_context.card_content to understand what the user was responding to
   - For commitment actions, use action_context.commitment_content and related fields to track changes`
  ].filter(Boolean).join('\n\n');
  
  // Canonicalize both prefix and suffix
  const canonicalizedPrefix = canonicalizePrompt(prefix);
  const canonicalizedSuffix = canonicalizePrompt(suffix);
  
  // Estimate token counts (rough approximation: 1 token ≈ 4 characters)
  const prefixTokenCount = Math.ceil(canonicalizedPrefix.length / 4);
  const suffixTokenCount = Math.ceil(canonicalizedSuffix.length / 4);
  
  return {
    prefix: canonicalizedPrefix,
    suffix: canonicalizedSuffix,
    last_processed_entry_id: lastProcessedEntryId || '',
    prefix_token_count: prefixTokenCount,
    suffix_token_count: suffixTokenCount
  };
}

