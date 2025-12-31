import type { Entry } from './db/daos/EntryDAO';

/**
 * Canonicalize prompts for token-level identity (required for provider caching)
 * 
 * Critical: Same input must produce exactly the same tokens
 */
export function canonicalizePrompt(text: string): string {
  // 1. Normalize whitespace (consistent newlines, no trailing spaces)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' '); // Normalize spaces
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  // 2. Remove comments from code blocks (if any)
  // Note: We don't have code blocks in our prompts, but this is here for completeness
  
  // 3. Ensure consistent formatting
  return text.trim();
}

/**
 * Canonicalize entries for deterministic serialization
 */
export function canonicalizeEntries(entries: Entry[]): string {
  // Sort by created_at (deterministic order)
  const sorted = [...entries].sort((a, b) => a.created_at - b.created_at);
  
  // Serialize with stable JSON (sorted keys, no whitespace)
  return sorted.map(e => {
    const obj: any = {
      id: e.id,
      text: e.text,
      created_at: e.created_at
    };
    
    // Only include non-null fields
    if (e.event_type) obj.event_type = e.event_type;
    if (e.linked_task_id) obj.linked_task_id = e.linked_task_id;
    if (e.linked_commitment_id) obj.linked_commitment_id = e.linked_commitment_id;
    if (e.location) obj.location = e.location;
    if (e.mood) obj.mood = e.mood;
    if (e.energy_level !== null && e.energy_level !== undefined) obj.energy_level = e.energy_level;
    
    // Parse and sort payload keys
    if (e.payload_json) {
      try {
        const payload = JSON.parse(e.payload_json);
        obj.payload = Object.keys(payload).sort().reduce((acc, k) => {
          acc[k] = payload[k];
          return acc;
        }, {} as any);
      } catch {
        // If payload is invalid JSON, skip it
      }
    }
    
    // Sort all keys alphabetically for deterministic output
    return JSON.stringify(obj, Object.keys(obj).sort());
  }).join('\n');
}

