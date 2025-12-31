import type { Entry } from './db/daos/EntryDAO';
import { canonicalizePrompt, canonicalizeEntries } from './prompt-canonicalizer';
import { FROZEN_SYSTEM_PROMPT, FROZEN_OUTPUT_SCHEMA, OUTPUT_SCHEMA_VERSION } from './frozen-prompts';

export interface PromptStructure {
  prefix: string; // Frozen (cached by provider)
  suffix: string; // Variable (processed each time)
  last_processed_entry_id: string;
  prefix_token_count: number; // Estimated
  suffix_token_count: number; // Estimated
}

/**
 * Build prompt with 70-90% frozen prefix + 10-30% variable suffix
 */
export function buildPrompt(
  allEntries: Entry[],
  lastProcessedEntryId: string | null,
  currentTime: number
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
  const suffix = [
    `<NewEntries count="${suffixEntries.length}">\n${canonicalizedSuffixEntries}\n</NewEntries>`,
    `\n<CurrentContext>\ncurrent_time=${currentTime}\ncurrent_date=${new Date(currentTime).toISOString().split('T')[0]}\n</CurrentContext>`,
    `\nGenerate the feed now.`
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

