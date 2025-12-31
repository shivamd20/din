import type { Entry } from './db/daos/EntryDAO';
import type { Task, Commitment, Signal } from './db/daos';
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
  signals?: Signal[];
  timeOfDay?: string;
  energyLevel?: number;
  location?: string;
}

/**
 * Build prompt with 70-90% frozen prefix + 10-30% variable suffix
 * Includes tasks, commitments, signals, and context for LLM linking
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
      created_at: t.created_at
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
  
  if (entityContext?.signals && entityContext.signals.length > 0) {
    const signalsJson = JSON.stringify(entityContext.signals.map(s => ({
      id: s.id,
      entry_id: s.entry_id,
      key: s.key,
      value: s.value,
      confidence: s.confidence,
      generated_at: s.generated_at
    })), null, 0);
    entitySections.push(`<RecentSignals count="${entityContext.signals.length}">\n${signalsJson}\n</RecentSignals>`);
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
  
  const suffix = [
    `<NewEntries count="${suffixEntries.length}">\n${canonicalizedSuffixEntries}\n</NewEntries>`,
    ...entitySections,
    `\n<CurrentContext>\n${contextParts.join('\n')}\n</CurrentContext>`,
    `\nGenerate the feed now. Use the provided tasks, commitments, and signals to link feed items appropriately via related_task_id, related_commitment_id, and related_signal_ids.

CRITICAL INSTRUCTIONS:
1. POTENTIAL COMMITMENTS: Analyze new entries for potential commitments. Detect statements like "I'll do it", "Remind me", "We should finish this". Generate potential_commitment items with deduplication_key. NEVER generate potential_commitment for commitments already in ActiveCommitments.

2. TASK GENERATION FROM COMMITMENTS: For each ActiveCommitment:
   - If time_horizon_type="date": Generate tasks leading up to deadline (e.g., "Draft outline", "Complete analysis", "Final review")
   - If time_horizon_type="daily": Generate daily recurring tasks
   - If time_horizon_type="weekly": Generate weekly recurring tasks  
   - If time_horizon_type="monthly": Generate monthly recurring tasks
   - If time_horizon_type="continuous"/"maintain": Generate maintenance tasks
   - If check_in_method="task_completion": Generate specific actionable tasks
   - Break down commitment content into smaller actionable steps
   - Set related_commitment_id on all generated tasks

3. DEDUPLICATION: Use deduplication_key (hash of normalized commitment content) to prevent duplicate potential commitments.`
  ].join('\n\n');
  
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

