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
        }

        // Simulate network delay
        await this.delay(this.mockConfig.delay);

        const messages = this.extractMessages(options.chatOptions.messages);
        const response = this.mockConfig.responseGenerator(messages);

        // Try to parse as JSON, otherwise create mock structured response
        let structuredData: unknown;
        try {
            structuredData = JSON.parse(response);
        } catch {
            structuredData = this.createMockStructuredResponse(options.outputSchema);
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

        // Handle structured output requests
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
                if (type === 'number') {
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
