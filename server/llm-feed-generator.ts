import { chat } from '@tanstack/ai';
import { AIModel } from './ai-model';
import type { PromptStructure, EntityContext } from './prompt-builder';
import { trackCacheMetrics, type CacheMetrics } from './cache-metrics';
import { z } from 'zod';
import type { FeedItemRendered } from './UserDO';
import type { Task } from './db/daos';

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
      "habit",
      "potential_commitment"
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
    duration_estimate: z.number().optional(),
    // Rich metadata fields
    generation_reason: z.string().optional(),
    related_task_id: z.string().nullable().optional(),
    related_commitment_id: z.string().nullable().optional(),
    source_entry_ids: z.array(z.string()).optional(),
    priority_score: z.number().min(0).max(1).optional(),
    expires_at: z.number().nullable().optional(),
    created_at: z.number().optional()
  })),
  commitment_updates: z.array(z.object({
    commitment_id: z.string(),
    status: z.enum(['on_track', 'drifting', 'at_risk', 'behind']),
    streak_count: z.number(),
    longest_streak: z.number().optional(),
    streak_message: z.string(),
    completion_percentage: z.number().min(0).max(100),
    days_since_last_progress: z.number().optional(),
    deadline_risk_score: z.number().min(0).max(1).optional(),
    consistency_score: z.number().min(0).max(1),
    momentum_score: z.number().min(0).max(1),
    engagement_score: z.number().min(0).max(1),
    user_message: z.string(),
    next_step: z.string(),
    health_scores: z.object({
      consistency: z.number().min(0).max(1),
      momentum: z.number().min(0).max(1),
      deadline_risk: z.number().min(0).max(1).optional(),
      engagement: z.number().min(0).max(1)
    }),
    detected_blockers: z.array(z.string()).optional(),
    identity_hint: z.string().optional(),
    should_complete: z.boolean().optional()
  })).optional()
});

type FeedOutput = z.infer<typeof FeedOutputSchema>;

export interface FeedItem {
  id: string;
  type: "immediate_action" | "prep_task" | "blocker" | "data_collection" | 
        "reflection" | "commitment_reminder" | "task" | "habit" | "potential_commitment";
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
  // Rich metadata fields
  generation_reason?: string;
  related_task_id?: string | null;
  related_commitment_id?: string | null;
  source_entry_ids?: string[];
  priority_score?: number;
  expires_at?: number | null;
  created_at?: number;
}

/**
 * Normalize content for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeContent(content: string): string {
  return content.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two task contents are semantically similar (70%+ similarity)
 * Simple implementation: check if normalized content is very similar
 */
function isSimilarContent(content1: string, content2: string): boolean {
  const norm1 = normalizeContent(content1);
  const norm2 = normalizeContent(content2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  if (norm1.length > 0 && norm2.length > 0) {
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    
    // If shorter is at least 70% of longer and is contained, consider similar
    if (shorter.length >= longer.length * 0.7 && longer.includes(shorter)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Deduplicate tasks based on commitment references and content matches
 */
function deduplicateTasks(
  items: FeedOutput['items'],
  activeTasks: Task[]
): FeedOutput['items'] {
  const taskItems = items.filter(item => item.type === 'task');
  const otherItems = items.filter(item => item.type !== 'task');
  
  const seenCommitments = new Set<string>();
  const seenContents = new Set<string>();
  const deduplicatedTasks: FeedOutput['items'] = [];
  
  for (const item of taskItems) {
    // Check commitment reference deduplication
    if (item.related_commitment_id) {
      // Check if task for this commitment already exists in active tasks
      const existingTaskForCommitment = activeTasks.find(
        t => t.commitment_id === item.related_commitment_id && t.status !== 'completed'
      );
      
      if (existingTaskForCommitment) {
        // Skip - task for this commitment already exists
        continue;
      }
      
      // Check if we've already generated a task for this commitment in this batch
      if (seenCommitments.has(item.related_commitment_id)) {
        continue;
      }
      seenCommitments.add(item.related_commitment_id);
    }
    
    // Check exact content match
    const normalizedContent = normalizeContent(item.phrasing);
    if (seenContents.has(normalizedContent)) {
      continue;
    }
    
    // Check against active tasks
    const exactMatch = activeTasks.some(
      t => normalizeContent(t.content) === normalizedContent && t.status !== 'completed'
    );
    if (exactMatch) {
      continue;
    }
    
    // Check semantic similarity against active tasks
    const similarMatch = activeTasks.some(
      t => t.status !== 'completed' && isSimilarContent(t.content, item.phrasing)
    );
    if (similarMatch) {
      continue;
    }
    
    seenContents.add(normalizedContent);
    deduplicatedTasks.push(item);
  }
  
  return [...otherItems, ...deduplicatedTasks];
}

/**
 * Apply context-aware suppression rules
 */
function applySuppression(
  items: FeedOutput['items'],
  entityContext: EntityContext | undefined,
  currentTime: number
): FeedOutput['items'] {
  const hour = new Date(currentTime).getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isEvening = hour >= 17 && hour < 21;
  const energyLevel = entityContext?.energyLevel ?? 0.5;
  
  // Get completed tasks in last 2 hours for recent activity suppression
  const twoHoursAgo = currentTime - (2 * 60 * 60 * 1000);
  const recentCompletedTasks = entityContext?.tasks?.filter(
    t => t.status === 'completed' && t.created_at >= twoHoursAgo
  ) ?? [];
  
  const filtered = items.filter(item => {
    // Time-based suppression
    if (item.context?.time_of_day) {
      const taskTimeOfDay = item.context.time_of_day.toLowerCase();
      if (isMorning && (taskTimeOfDay.includes('evening') || taskTimeOfDay.includes('night'))) {
        return false; // Suppress evening tasks in morning
      }
      if (isEvening && (taskTimeOfDay.includes('morning') || taskTimeOfDay.includes('early'))) {
        return false; // Suppress morning tasks in evening
      }
    }
    
    // Energy-based suppression
    if (item.urgency > 0.7 && energyLevel < 0.4) {
      return false; // Suppress high-energy tasks when energy is low
    }
    
    // Recent activity suppression
    const itemContent = normalizeContent(item.phrasing);
    const recentlyCompleted = recentCompletedTasks.some(
      t => isSimilarContent(t.content, itemContent)
    );
    if (recentlyCompleted) {
      return false; // Suppress if similar task completed recently
    }
    
    return true;
  });
  
  // Overwhelm detection: if >5 items, suppress items with priority_score < 0.5
  if (filtered.length > 5) {
    return filtered
      .filter(item => {
        const priorityScore = item.priority_score ?? (item.urgency * item.importance);
        return priorityScore >= 0.5;
      })
      .slice(0, 7); // Max 7 items
  }
  
  return filtered;
}

/**
 * Generate feed using unified chat infrastructure with structured output
 */
export async function generateFeed(
  promptStructure: PromptStructure,
  env: Env & { 
    ANTHROPIC_API_KEY?: SecretsStoreSecret | string;
    GEMINI_API_KEY?: SecretsStoreSecret | string;
  },
  entityContext?: EntityContext,
  currentTime?: number
): Promise<{ items: FeedItemRendered[]; metrics: CacheMetrics; commitment_updates?: FeedOutput['commitment_updates'] }> {
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
  const now = currentTime ?? Date.now();
  
  // Step 1: Deduplicate potential commitments by deduplication_key
  const potentialCommitmentsMap = new Map<string, typeof feedOutput.items[0]>();
  const nonPotentialCommitmentItems: typeof feedOutput.items = [];
  
  feedOutput.items.forEach(item => {
    if (item.type === "potential_commitment") {
      // Extract deduplication_key from metadata if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = (item as any).metadata || {};
      const deduplicationKey = metadata.deduplication_key || item.id;
      
      // Keep the one with highest priority_score
      const existing = potentialCommitmentsMap.get(deduplicationKey);
      if (!existing || (item.priority_score ?? (item.urgency * item.importance)) > (existing.priority_score ?? (existing.urgency * existing.importance))) {
        potentialCommitmentsMap.set(deduplicationKey, item);
      }
    } else {
      nonPotentialCommitmentItems.push(item);
    }
  });
  
  // Step 2: Deduplicate tasks based on commitment references and content matches
  const activeTasks = entityContext?.tasks?.filter(t => t.status !== 'completed') ?? [];
  const deduplicatedTasks = deduplicateTasks(nonPotentialCommitmentItems, activeTasks);
  
  // Step 3: Combine deduplicated potential commitments with deduplicated tasks
  const deduplicatedItems = [...Array.from(potentialCommitmentsMap.values()), ...deduplicatedTasks];
  
  // Step 4: Apply context-aware suppression rules
  const suppressedItems = applySuppression(deduplicatedItems, entityContext, now);
  
  // Step 5: Sort by priority score (highest first)
  const sortedItems = suppressedItems.sort((a, b) => {
    const scoreA = a.priority_score ?? (a.urgency * a.importance);
    const scoreB = b.priority_score ?? (b.urgency * b.importance);
    return scoreB - scoreA;
  });
  
  const items: FeedItemRendered[] = sortedItems.map(item => {
    // Calculate priority_score if not provided (composite of urgency × importance)
    const priorityScore = item.priority_score ?? (item.urgency * item.importance);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemMetadata = (item as any).metadata || {};
    
    return {
      id: item.id,
      phrasing: item.phrasing,
      supporting_note: item.supporting_note,
      suggested_actions: item.suggested_actions,
      // Rich metadata fields
      generation_reason: item.generation_reason,
      related_task_id: item.related_task_id ?? null,
      related_commitment_id: item.related_commitment_id ?? null,
      source_entry_ids: item.source_entry_ids ?? item.related_entry_ids ?? [],
      priority_score: priorityScore,
      expires_at: item.expires_at ?? null,
      created_at: item.created_at ?? now,
      type: item.type,
      metadata: {
        context: item.context,
        timing: item.timing,
        urgency: item.urgency,
        importance: item.importance,
        deadline: item.deadline,
        duration_estimate: item.duration_estimate,
        // Include potential commitment metadata
        ...(item.type === "potential_commitment" && {
          detected_strength: itemMetadata.detected_strength,
          detected_horizon: itemMetadata.detected_horizon,
          consequence_level: itemMetadata.consequence_level,
          time_horizon_type: itemMetadata.time_horizon_type,
          time_horizon_value: itemMetadata.time_horizon_value,
          cadence_days: itemMetadata.cadence_days,
          check_in_method: itemMetadata.check_in_method,
          deduplication_key: itemMetadata.deduplication_key
        })
      }
    };
  });
  
  return { 
    items, 
    metrics,
    commitment_updates: feedOutput.commitment_updates
  };
}

