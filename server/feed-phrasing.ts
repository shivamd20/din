import { z } from 'zod';
import { chat } from '@tanstack/ai';
import { AIModel } from './ai-model';
import type { FeedItem } from './feed-generator';
import type { FeedItemRendered } from './UserFeedDO';

const FeedItemRenderedSchema = z.object({
    id: z.string(),
    phrasing: z.string(),
    supporting_note: z.string().optional(),
    suggested_actions: z.array(z.object({
        action: z.string(),
        label: z.string()
    }))
});

const FeedPhrasingOutputSchema = z.object({
    items: z.array(FeedItemRenderedSchema)
});

/**
 * Phrase feed items using LLM
 */
export async function phraseFeedItems(
    items: FeedItem[],
    currentTime: number,
    userContext?: string,
    env?: Env & { USE_MOCK_ADAPTER?: string; USE_MOCK_ADAPTER_DEBUG?: string }
): Promise<FeedItemRendered[]> {
    if (!env) {
        throw new Error('Environment not provided');
    }

    const aiModel = new AIModel(env as Env & { USE_MOCK_ADAPTER?: string; USE_MOCK_ADAPTER_DEBUG?: string });
    const adapter = aiModel.getAdapter();

    const currentTimeStr = new Date(currentTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });

    const systemPrompt = `You are phrasing feed items for DIN, a personal productivity assistant.
Your tone should be:
- Empathetic and supportive
- Concise and clear
- Time-aware and contextual
- Action-oriented but not pushy
- Respectful of the user's autonomy

Keep messages brief (1-2 sentences max for phrasing, optional supporting note).`;

    const inputIds = items.map(item => item.id).join(', ');
    const userPrompt = `You are phrasing feed items for DIN.

Current time: ${currentTimeStr}
${userContext ? `User context: ${userContext}` : ''}

Feed items to phrase (pre-prioritized):
${JSON.stringify(items, null, 2)}

CRITICAL REQUIREMENTS:
1. You MUST return exactly ${items.length} items (one for each input item)
2. You MUST return items in the EXACT same order as the input
3. Each output item MUST have an "id" that exactly matches one of these input IDs: ${inputIds}
4. You MUST include ALL input items - do not skip or omit any

Return output strictly as JSON matching this schema:
{
  "items": [
    {
      "id": "...",  // MUST exactly match one of the input IDs: ${inputIds}
      "phrasing": "...",  // Main message (1-2 sentences)
      "supporting_note": "...",  // Optional additional context
      "suggested_actions": [
        { "action": "...", "label": "..." }  // Map from input suggested_actions
      ]
    }
  ]
}

Rules:
- Return EXACTLY ${items.length} items in the EXACT same order as input
- Each "id" field MUST exactly match an input item's id
- Do not invent new information
- Do not reorder items (keep same order as input)
- Do not invent actions (use only actions from input suggested_actions)
- Keep messages concise, supportive, and time-aware
- Map actions to user-friendly labels (e.g., "complete" → "Done", "snooze" → "Snooze", "start" → "Start 25m")`;

    try {
        // TanStack AI doesn't support 'system' role, so we prepend it to the user message
        const result = await chat({
            adapter,
            messages: [
                { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
            ],
            outputSchema: FeedPhrasingOutputSchema
        });

        // Validate that all input items have corresponding output items
        const inputIds = items.map(item => item.id);
        const outputIds = result.items.map(item => item.id);
        const inputIdsSet = new Set(inputIds);
        const outputIdsSet = new Set(outputIds);

        // Check if all IDs match
        const missingIds = inputIds.filter(id => !outputIdsSet.has(id));
        const extraIds = outputIds.filter(id => !inputIdsSet.has(id));
        const hasDuplicates = outputIds.length !== outputIdsSet.size;

        if (inputIds.length !== outputIds.length || missingIds.length > 0 || extraIds.length > 0 || hasDuplicates) {
            console.warn('[FeedPhrasing] Output items do not match input items, using fallback', {
                inputCount: inputIds.length,
                outputCount: outputIds.length,
                missingIds,
                extraIds,
                hasDuplicates,
                inputIds,
                outputIds
            });
            return createFallbackPhrasing(items);
        }

        // Verify order matches (optional but helpful)
        const orderMatches = inputIds.every((id, index) => outputIds[index] === id);
        if (!orderMatches) {
            console.warn('[FeedPhrasing] Output items are in different order than input, but IDs match. Reordering...');
            // Reorder output items to match input order
            const outputMap = new Map(result.items.map(item => [item.id, item]));
            return inputIds.map(id => outputMap.get(id)!).filter(Boolean);
        }

        return result.items;
    } catch (error) {
        console.error('[FeedPhrasing] Failed to phrase feed items:', error);
        // Retry once
        try {
            const result = await chat({
                adapter,
                messages: [
                    { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
                ],
                outputSchema: FeedPhrasingOutputSchema
            });

            // Validate retry result with same logic
            const inputIds = items.map(item => item.id);
            const outputIds = result.items.map(item => item.id);
            const inputIdsSet = new Set(inputIds);
            const outputIdsSet = new Set(outputIds);

            const missingIds = inputIds.filter(id => !outputIdsSet.has(id));
            const extraIds = outputIds.filter(id => !inputIdsSet.has(id));
            const hasDuplicates = outputIds.length !== outputIdsSet.size;

            if (inputIds.length !== outputIds.length || missingIds.length > 0 || extraIds.length > 0 || hasDuplicates) {
                console.warn('[FeedPhrasing] Retry output items do not match input items, using fallback', {
                    inputCount: inputIds.length,
                    outputCount: outputIds.length,
                    missingIds,
                    extraIds,
                    hasDuplicates
                });
                return createFallbackPhrasing(items);
            }

            // Verify order matches
            const orderMatches = inputIds.every((id, index) => outputIds[index] === id);
            if (!orderMatches) {
                console.warn('[FeedPhrasing] Retry output items are in different order, reordering...');
                const outputMap = new Map(result.items.map(item => [item.id, item]));
                return inputIds.map(id => outputMap.get(id)!).filter(Boolean);
            }

            return result.items;
        } catch (retryError) {
            console.error('[FeedPhrasing] Retry also failed:', retryError);
            // Return fallback phrasing
            return createFallbackPhrasing(items);
        }
    }
}

/**
 * Create fallback phrasing when LLM fails
 */
function createFallbackPhrasing(items: FeedItem[]): FeedItemRendered[] {
    const actionLabelMap: Record<string, string> = {
        'complete': 'Done',
        'snooze': 'Snooze',
        'skip': 'Skip',
        'start': 'Start 25m',
        'acknowledge': 'Acknowledge',
        'done': 'Done',
        'remind': 'Remind me',
        'open_capture': 'Log'
    };

    return items.map(item => {
        const actions = item.suggested_actions.map(action => ({
            action,
            label: actionLabelMap[action] || action
        }));

        let phrasing = '';
        if (item.type === 'task') {
            phrasing = `You have a task: ${item.description}`;
        } else if (item.type === 'commitment') {
            phrasing = `You committed to: ${item.description}`;
        } else if (item.type === 'reminder') {
            phrasing = `Reminder: ${item.description}`;
        } else if (item.type === 'habit') {
            phrasing = `Habit reminder: ${item.description}`;
        } else if (item.type === 'reflection') {
            phrasing = `Reflection: ${item.description}`;
        } else {
            phrasing = item.description;
        }

        return {
            id: item.id,
            phrasing,
            supporting_note: item.reason,
            suggested_actions: actions
        };
    });
}

