import { chat } from '@tanstack/ai';
import { AIModel } from './ai-model';
import type { PromptStructure } from './prompt-builder';
import { trackCacheMetrics, type CacheMetrics } from './cache-metrics';
import { z } from 'zod';
import type { FeedItemRendered } from './UserDO';

// Zod schema matching FROZEN_OUTPUT_SCHEMA
const FeedOutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "immediate_action", 
      "prep_task", 
      "blocker", 
      "data_collection", 
      "reflection", 
      "commitment_reminder", 
      "task", 
      "habit"
    ]),
    phrasing: z.string(),
    supporting_note: z.string().optional(),
    urgency: z.number().min(0).max(1),
    importance: z.number().min(0).max(1),
    timing: z.enum(["now", "soon", "today", "this-week"]),
    suggested_actions: z.array(z.object({
      action: z.string(),
      label: z.string()
    })),
    context: z.object({
      time_of_day: z.string().optional(),
      energy_level: z.number().optional(),
      location: z.string().optional()
    }).optional(),
    related_entry_ids: z.array(z.string()).optional(),
    deadline: z.number().optional(),
    duration_estimate: z.number().optional()
  }))
});

type FeedOutput = z.infer<typeof FeedOutputSchema>;

export interface FeedItem {
  id: string;
  type: "immediate_action" | "prep_task" | "blocker" | "data_collection" | 
        "reflection" | "commitment_reminder" | "task" | "habit";
  phrasing: string;
  supporting_note?: string;
  urgency: number; // 0-1
  importance: number; // 0-1
  timing: "now" | "soon" | "today" | "this-week";
  suggested_actions: Array<{ action: string; label: string }>;
  context?: {
    time_of_day?: string;
    energy_level?: number;
    location?: string;
  };
  related_entry_ids?: string[];
  deadline?: number;
  duration_estimate?: number;
}

/**
 * Generate feed using unified chat infrastructure with structured output
 */
export async function generateFeed(
  promptStructure: PromptStructure,
  env: Env & { 
    ANTHROPIC_API_KEY?: SecretsStoreSecret | string;
    GEMINI_API_KEY?: SecretsStoreSecret | string;
  }
): Promise<{ items: FeedItemRendered[]; metrics: CacheMetrics }> {
  const startTime = Date.now();
  const aiModel = new AIModel(env);
  const adapter = await aiModel.getAdapter();

  // Use same chat infrastructure as regular chat, but with structured output
  const result = await chat({
    adapter,
    messages: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { role: 'system' as any, content: promptStructure.prefix }, // Frozen prefix - cached
      { role: 'user', content: promptStructure.suffix } // Variable suffix - processed
    ],
    outputSchema: FeedOutputSchema, // Structured output
    providerOptions: {
      temperature: 0, // CRITICAL: Determinism required for caching
      topP: 1, // CRITICAL: Determinism
      maxTokens: 4000
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Extract usage from adapter response
  // Note: tanstack/ai may need adapter-specific handling for cache metrics
  // The adapter should yield usage in response-metadata chunks
  // For now, we'll use estimated values if usage is not available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = (result as any).usage || (result as any).metadata?.usage || {
    input_tokens: promptStructure.prefix_token_count + promptStructure.suffix_token_count,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0
  };
  
  // Track cache metrics
  const metrics = trackCacheMetrics(
    promptStructure,
    { usage },
    startTime
  );

  // Convert to FeedItemRendered format
  // When using outputSchema, chat returns the structured data directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedOutput = result as any as FeedOutput;
  const items: FeedItemRendered[] = feedOutput.items.map(item => ({
    id: item.id,
    phrasing: item.phrasing,
    supporting_note: item.supporting_note,
    suggested_actions: item.suggested_actions
  }));
  
  return { items, metrics };
}

