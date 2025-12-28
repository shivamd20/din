import type {
    TextAdapter,
    TextOptions,
    StreamChunk,
    DefaultMessageMetadataByModality,
    ModelMessage,
    ContentPart,
    JSONSchema,
} from '@tanstack/ai';
import {
    BaseTextAdapter,
    type TextAdapterConfig,
    type StructuredOutputOptions,
    type StructuredOutputResult,
} from '@tanstack/ai/adapters';

/**
 * Configuration for the mock adapter
 */
export interface MockAdapterConfig extends TextAdapterConfig {
    /**
     * Delay in milliseconds to simulate network latency
     * @default 100
     */
    delay?: number;

    /**
     * Delay between streaming chunks in milliseconds
     * @default 50
     */
    chunkDelay?: number;

    /**
     * Custom response generator function
     * If not provided, uses default echo/reflection behavior
     */
    responseGenerator?: (messages: Array<{ role: string; content: string }>) => string;

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;
}

/**
 * Mock adapter for TanStack AI that works offline.
 * 
 * This adapter simulates an LLM provider by:
 * - Echoing back user messages with a reflection
 * - Supporting streaming responses
 * - Simulating realistic delays
 * - Supporting structured output schemas
 * 
 * @example
 * ```ts
 * import { mockText } from './mock-adapter';
 * import { chat } from '@tanstack/ai';
 * 
 * const adapter = mockText({ delay: 200 });
 * const stream = chat({
 *   adapter: adapter('mock-model'),
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class MockTextAdapter extends BaseTextAdapter<'mock-model', Record<string, unknown>, readonly ['text'], DefaultMessageMetadataByModality> {
    readonly name = 'mock';
    private mockConfig: Required<Pick<MockAdapterConfig, 'delay' | 'chunkDelay' | 'responseGenerator' | 'debug'>>;

    constructor(config: MockAdapterConfig = {}, model: 'mock-model' = 'mock-model') {
        super(config, model);
        this.mockConfig = {
            delay: config.delay ?? 100,
            chunkDelay: config.chunkDelay ?? 50,
            responseGenerator: config.responseGenerator ?? this.defaultResponseGenerator,
            debug: config.debug ?? false,
        };
    }

    /**
     * Stream text completions from the model
     */
    async *chatStream(options: TextOptions<Record<string, unknown>>): AsyncIterable<StreamChunk> {
        if (this.mockConfig.debug) {
            console.log('[MockAdapter] Streaming response for:', options.messages);
        }

        // Simulate initial delay
        await this.delay(this.mockConfig.delay);

        const messages = this.extractMessages(options.messages);
        const fullResponse = this.mockConfig.responseGenerator(messages);

        const modelId = this.model;
        const chunkId = this.generateId();
        const timestamp = Date.now();

        // Stream the response word by word
        const words = fullResponse.split(/(\s+)/);
        let accumulated = '';

        for (const word of words) {
            accumulated += word;

            yield {
                type: 'content',
                id: chunkId,
                model: modelId,
                timestamp,
                delta: word,
                content: accumulated,
                role: 'assistant',
            } as StreamChunk;

            // Simulate chunk delay
            await this.delay(this.mockConfig.chunkDelay);
        }

        // Send done message
        yield {
            type: 'done',
            id: chunkId,
            model: modelId,
            timestamp,
            finishReason: 'stop',
            usage: {
                promptTokens: this.estimateTokens(this.messagesToText(messages)),
                completionTokens: this.estimateTokens(fullResponse),
                totalTokens: this.estimateTokens(this.messagesToText(messages)) + this.estimateTokens(fullResponse),
            },
        } as StreamChunk;
    }

    /**
     * Generate structured output
     */
    async structuredOutput(
        options: StructuredOutputOptions<Record<string, unknown>>
    ): Promise<StructuredOutputResult<unknown>> {
        if (this.mockConfig.debug) {
            console.log('[MockAdapter] Generating structured output for:', options.chatOptions.messages);
            console.log('[MockAdapter] Output schema:', JSON.stringify(options.outputSchema, null, 2));
        }

        // Simulate network delay
        await this.delay(this.mockConfig.delay);

        const messages = this.extractMessages(options.chatOptions.messages);
        const response = this.mockConfig.responseGenerator(messages);

        // Try to parse as JSON, otherwise create mock structured response
        let structuredData: unknown;
        try {
            structuredData = JSON.parse(response);
            
            // Validate that the parsed data matches the schema structure
            // If it doesn't, fall back to schema-based generation
            if (options.outputSchema && !this.validateAgainstSchema(structuredData, options.outputSchema)) {
                if (this.mockConfig.debug) {
                    console.log('[MockAdapter] Response does not match schema, generating from schema');
                }
                structuredData = this.createMockStructuredResponse(options.outputSchema);
            }
        } catch {
            if (this.mockConfig.debug) {
                console.log('[MockAdapter] Failed to parse JSON, generating from schema');
            }
            structuredData = this.createMockStructuredResponse(options.outputSchema);
        }

        if (this.mockConfig.debug) {
            console.log('[MockAdapter] Returning structured data:', JSON.stringify(structuredData, null, 2));
        }

        return {
            data: structuredData,
            rawText: response,
        };
    }

    /**
     * Default response generator that reflects on user input
     */
    private defaultResponseGenerator = (messages: Array<{ role: string; content: string }>): string => {
        const lastUserMessage = messages
            .filter((m) => m.role === 'user')
            .slice(-1)[0];

        if (!lastUserMessage) {
            return "I'm here to help. What would you like to discuss?";
        }

        const userContent = lastUserMessage.content.toLowerCase();

        // Handle feed phrasing requests
        if (userContent.includes('phrasing feed items') || 
            userContent.includes('feed items to phrase') ||
            (userContent.includes('feed') && userContent.includes('items') && userContent.includes('phrase'))) {
            // Try to extract feed items from the message
            let feedItems: Array<{ id: string; type: string; description: string; suggested_actions: string[] }> = [];
            try {
                // Look for JSON array in the message - try multiple patterns
                // Pattern 1: Look for "Feed items to phrase:" followed by JSON array (handle multi-line)
                const feedItemsIndex = lastUserMessage.content.indexOf('Feed items to phrase');
                if (feedItemsIndex !== -1) {
                    // Find the opening bracket after "Feed items to phrase"
                    const afterLabel = lastUserMessage.content.substring(feedItemsIndex);
                    const bracketIndex = afterLabel.indexOf('[');
                    if (bracketIndex !== -1) {
                        // Extract from opening bracket and find matching closing bracket
                        let bracketCount = 0;
                        let endIndex = bracketIndex;
                        for (let i = bracketIndex; i < afterLabel.length; i++) {
                            if (afterLabel[i] === '[') bracketCount++;
                            if (afterLabel[i] === ']') bracketCount--;
                            if (bracketCount === 0) {
                                endIndex = i + 1;
                                break;
                            }
                        }
                        if (bracketCount === 0) {
                            const jsonStr = afterLabel.substring(bracketIndex, endIndex);
                            const parsed = JSON.parse(jsonStr);
                            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
                                feedItems = parsed;
                            }
                        }
                    }
                }
                
                // Pattern 2: If not found, look for any JSON array with objects that have 'id' fields
                if (feedItems.length === 0) {
                    // Find all potential JSON arrays
                    let bracketIndex = lastUserMessage.content.indexOf('[');
                    while (bracketIndex !== -1 && feedItems.length === 0) {
                        let bracketCount = 0;
                        let endIndex = bracketIndex;
                        for (let i = bracketIndex; i < lastUserMessage.content.length; i++) {
                            if (lastUserMessage.content[i] === '[') bracketCount++;
                            if (lastUserMessage.content[i] === ']') bracketCount--;
                            if (bracketCount === 0) {
                                endIndex = i + 1;
                                break;
                            }
                        }
                        if (bracketCount === 0) {
                            try {
                                const jsonStr = lastUserMessage.content.substring(bracketIndex, endIndex);
                                const parsed = JSON.parse(jsonStr);
                                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
                                    feedItems = parsed;
                                    break;
                                }
                            } catch {
                                // Try next bracket
                            }
                        }
                        bracketIndex = lastUserMessage.content.indexOf('[', bracketIndex + 1);
                    }
                }
                
                if (feedItems.length === 0) {
                    throw new Error('No valid feed items found');
                }
            } catch (error) {
                if (this.mockConfig.debug) {
                    console.log('[MockAdapter] Failed to parse feed items from message, attempting fallback extraction:', error);
                }
                // Try a more aggressive extraction - look for the items array anywhere
                try {
                    // Look for the items array in the JSON structure
                    const itemsMatch = lastUserMessage.content.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
                    if (itemsMatch) {
                        const parsed = JSON.parse(itemsMatch[1]);
                        if (Array.isArray(parsed)) {
                            feedItems = parsed;
                        }
                    }
                } catch {
                    // Last resort: try to find any array with objects that have 'id' fields
                    const arrayMatches = lastUserMessage.content.matchAll(/\[([\s\S]*?)\]/g);
                    for (const match of arrayMatches) {
                        try {
                            const parsed = JSON.parse(match[0]);
                            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
                                feedItems = parsed;
                                break;
                            }
                        } catch {
                            continue;
                        }
                    }
                }
                
                // If still no items found, we can't proceed - this should not happen
                if (feedItems.length === 0) {
                    if (this.mockConfig.debug) {
                        console.error('[MockAdapter] Could not extract feed items from message');
                    }
                    // Return empty array - the validation will catch this
                    return JSON.stringify({ items: [] });
                }
            }

            if (this.mockConfig.debug) {
                console.log('[MockAdapter] Extracted feed items:', feedItems.map(item => ({ id: item.id, type: item.type })));
            }

            // Generate phrased feed items
            const phrasedItems = feedItems.map(item => {
                let phrasing = '';
                let supportingNote = '';
                
                if (item.type === 'task') {
                    phrasing = `You have a task: ${item.description}. Want to tackle it now?`;
                    supportingNote = 'This task is ready to be completed.';
                } else if (item.type === 'commitment') {
                    phrasing = `You committed to: ${item.description}. How's it going?`;
                    supportingNote = 'This commitment is important to you.';
                } else if (item.type === 'reminder') {
                    phrasing = `Reminder: ${item.description}. Ready to start?`;
                    supportingNote = 'This is a good time to act on this.';
                } else if (item.type === 'habit') {
                    phrasing = `Habit reminder: ${item.description}. Time to check in?`;
                    supportingNote = 'This habit helps you stay consistent.';
                } else {
                    phrasing = item.description;
                }

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

                return {
                    id: item.id,
                    phrasing,
                    supporting_note: supportingNote,
                    suggested_actions: item.suggested_actions.map(action => ({
                        action,
                        label: actionLabelMap[action] || action
                    }))
                };
            });

            return JSON.stringify({ items: phrasedItems });
        }

        // Handle batch signals/commitments/tasks generation
        if (userContent.includes('analyzing user captures') || 
            (userContent.includes('signals') && userContent.includes('commitments') && userContent.includes('tasks'))) {
            // Extract entry IDs from the message if possible
            const entryIdMatches = lastUserMessage.content.match(/ID: ([a-f0-9-]+)/gi);
            const entryIds = entryIdMatches ? entryIdMatches.map(m => m.replace('ID: ', '')) : ['mock-entry-1', 'mock-entry-2'];
            
            return JSON.stringify({
                signals: entryIds.slice(0, 2).flatMap(entryId => [
                    { entry_id: entryId, key: 'actionability', value: 0.5, confidence: 0.8 },
                    { entry_id: entryId, key: 'temporal_proximity', value: 0.6, confidence: 0.7 },
                    { entry_id: entryId, key: 'consequence_strength', value: 0.4, confidence: 0.75 },
                ]),
                commitments: entryIds.slice(0, 1).map(entryId => ({
                    origin_entry_id: entryId,
                    strength: 'medium',
                    horizon: 'short',
                    content: 'Mock commitment from batch processing'
                })),
                tasks: [
                    { content: 'Complete mock task from batch processing', priority: 'high' },
                    { content: 'Follow up on mock task', priority: 'medium', due_date: Date.now() + 7 * 24 * 60 * 60 * 1000 }
                ]
            });
        }

        // Handle structured output requests (single entry signals)
        if (userContent.includes('extract') || userContent.includes('signal') || userContent.includes('json')) {
            return JSON.stringify({
                actionability: 0.5,
                temporal_proximity: 0.5,
                consequence_strength: 0.5,
                external_coupling: 0.5,
                scope_shortness: 0.5,
                habit_likelihood: 0.5,
                tone_stress: 0.5,
            });
        }

        // Handle tool usage requests
        if (userContent.includes('log') || userContent.includes('timeline')) {
            return "I understand you'd like to log something. In a real scenario, I would use the logToTimeline tool.";
        }

        // Default reflection response
        const reflections = [
            `I hear you saying: "${lastUserMessage.content}". That's interesting. What patterns do you notice here?`,
            `You mentioned: "${lastUserMessage.content}". How does that make you feel?`,
            `I'm reflecting on: "${lastUserMessage.content}". What insights come up for you?`,
            `You shared: "${lastUserMessage.content}". Let's explore what this means for you.`,
        ];

        return reflections[Math.floor(Math.random() * reflections.length)];
    };

    /**
     * Extract messages from TanStack format
     */
    private extractMessages(
        messages: Array<ModelMessage<string | Array<ContentPart> | null>>
    ): Array<{ role: string; content: string }> {
        return messages.map((msg) => {
            let content: string;
            if (typeof msg.content === 'string') {
                content = msg.content;
            } else if (Array.isArray(msg.content)) {
                // Extract text from parts
                content = msg.content
                    .filter((part) => part.type === 'text')
                    .map((part) => {
                        const textPart = part as { content: string };
                        return textPart.content;
                    })
                    .join('');
            } else if (msg.content === null) {
                content = '';
            } else {
                content = String(msg.content);
            }

            return {
                role: msg.role,
                content,
            };
        });
    }

    /**
     * Convert messages to text for token estimation
     */
    private messagesToText(messages: Array<{ role: string; content: string }>): string {
        return messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    }

    /**
     * Validate that data matches the expected schema structure
     */
    private validateAgainstSchema(data: unknown, schema: JSONSchema): boolean {
        if (!schema?.properties || typeof data !== 'object' || data === null) {
            return false;
        }

        const dataObj = data as Record<string, unknown>;
        
        for (const [key, field] of Object.entries(schema.properties)) {
            const fieldSchema = field as JSONSchema;
            const type = Array.isArray(fieldSchema.type) 
                ? fieldSchema.type[0] 
                : fieldSchema.type;
            
            if (!(key in dataObj)) {
                return false;
            }

            if (type === 'array') {
                if (!Array.isArray(dataObj[key])) {
                    return false;
                }
            } else if (type === 'number') {
                if (typeof dataObj[key] !== 'number') {
                    return false;
                }
            } else if (type === 'string') {
                if (typeof dataObj[key] !== 'string') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Create a mock structured response based on schema
     */
    private createMockStructuredResponse(
        schema: JSONSchema
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        if (schema?.properties) {
            for (const [key, field] of Object.entries(schema.properties)) {
                const fieldSchema = field as JSONSchema;
                const type = Array.isArray(fieldSchema.type) 
                    ? fieldSchema.type[0] 
                    : fieldSchema.type;
                
                if (type === 'array' && fieldSchema.items) {
                    // Handle arrays - return array with at least one mock item
                    const itemSchema = fieldSchema.items as JSONSchema;
                    if (itemSchema.type === 'object' && itemSchema.properties) {
                        // Create a mock object for array items
                        const mockItem: Record<string, unknown> = {};
                        for (const [itemKey, itemField] of Object.entries(itemSchema.properties)) {
                            const itemFieldSchema = itemField as JSONSchema;
                            const itemType = Array.isArray(itemFieldSchema.type) 
                                ? itemFieldSchema.type[0] 
                                : itemFieldSchema.type;
                            if (itemType === 'number') {
                                mockItem[itemKey] = 0.5;
                            } else if (itemType === 'string') {
                                mockItem[itemKey] = `mock-${itemKey}`;
                            } else {
                                mockItem[itemKey] = null;
                            }
                        }
                        // Return array with one item (not empty)
                        result[key] = [mockItem];
                    } else {
                        result[key] = [];
                    }
                } else if (type === 'number') {
                    // Return a value between 0 and 1 for signal extraction
                    result[key] = 0.5;
                } else if (type === 'string') {
                    result[key] = `mock-${key}`;
                } else if (type === 'boolean') {
                    result[key] = false;
                } else {
                    result[key] = null;
                }
            }
        }

        return result;
    }

    /**
     * Estimate tokens (simple approximation: 1 token ≈ 4 characters)
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Factory function to create a mock text adapter.
 * 
 * @example
 * ```ts
 * const adapter = mockText({ delay: 200, debug: true });
 * const model = adapter('mock-model');
 * ```
 */
export function mockText(config: MockAdapterConfig = {}) {
    return (modelId: 'mock-model' = 'mock-model'): TextAdapter<'mock-model', Record<string, unknown>, readonly ['text'], DefaultMessageMetadataByModality> => {
        return new MockTextAdapter(config, modelId);
    };
}

/**
 * Create a mock adapter instance directly.
 * 
 * @example
 * ```ts
 * const adapter = mockTextModel('mock-model', { delay: 100 });
 * ```
 */
export function mockTextModel(
    modelId: 'mock-model' = 'mock-model',
    config?: MockAdapterConfig
): TextAdapter<'mock-model', Record<string, unknown>, readonly ['text'], DefaultMessageMetadataByModality> {
    return new MockTextAdapter(config, modelId);
}
