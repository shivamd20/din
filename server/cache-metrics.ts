import type { PromptStructure } from './prompt-builder';

export interface CacheMetrics {
  prefix_token_count: number;
  suffix_token_count: number;
  cache_read_tokens: number; // From provider response
  cache_write_tokens: number; // From provider response
  cache_hit_rate: number; // read / (read + write)
  cost_read: number; // read_tokens * cost per token
  cost_write: number; // write_tokens * cost per token
  total_cost: number;
  generation_time_ms: number;
}

/**
 * Track cache metrics from Anthropic response
 * 
 * Anthropic pricing (approximate - check latest):
 * - Haiku: Input $0.25/MTok, Output $1.25/MTok
 * - Cache read: Same as input pricing
 * - Cache write: Same as input pricing
 */
export function trackCacheMetrics(
  promptStructure: PromptStructure,
  response: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  },
  startTime: number
): CacheMetrics {
  // Anthropic cache metrics
  const usage = response.usage || {};
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const totalInput = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  
  // If cache_read is 0, all tokens were written (first time or cache miss)
  // If cache_read > 0, those tokens were read from cache
  const read = cacheRead;
  const write = totalInput - read; // Remaining tokens that were processed
  
  // Anthropic Haiku pricing (adjust based on actual pricing)
  const INPUT_COST_PER_MTOK = 0.25; // $0.25 per million tokens
  const OUTPUT_COST_PER_MTOK = 1.25; // $1.25 per million tokens
  
  const costRead = (read * INPUT_COST_PER_MTOK) / 1_000_000;
  const costWrite = (write * INPUT_COST_PER_MTOK) / 1_000_000;
  const costOutput = (outputTokens * OUTPUT_COST_PER_MTOK) / 1_000_000;
  const totalCost = costRead + costWrite + costOutput;
  
  return {
    prefix_token_count: promptStructure.prefix_token_count,
    suffix_token_count: promptStructure.suffix_token_count,
    cache_read_tokens: read,
    cache_write_tokens: write,
    cache_hit_rate: totalInput > 0 ? read / totalInput : 0,
    cost_read: costRead,
    cost_write: costWrite,
    total_cost: totalCost,
    generation_time_ms: Date.now() - startTime
  };
}

