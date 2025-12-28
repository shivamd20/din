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

    const userPrompt = `You are phrasing feed items for DIN.

Current time: ${currentTimeStr}
${userContext ? `User context: ${userContext}` : ''}

Feed items to phrase (pre-prioritized):
${JSON.stringify(items, null, 2)}

Return output strictly as JSON matching this schema:
{
  "items": [
    {
      "id": "...",  // Must match the id from input
      "phrasing": "...",  // Main message (1-2 sentences)
      "supporting_note": "...",  // Optional additional context
      "suggested_actions": [
        { "action": "...", "label": "..." }  // Map from input suggested_actions
      ]
    }
  ]
}

Rules:
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
        const inputIds = new Set(items.map(item => item.id));
        const outputIds = new Set(result.items.map(item => item.id));

        // Check if all IDs match
        if (inputIds.size !== outputIds.size || 
            !Array.from(inputIds).every(id => outputIds.has(id))) {
            console.warn('[FeedPhrasing] Output items do not match input items, using fallback');
            return createFallbackPhrasing(items);
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

