import Anthropic from '@anthropic-ai/sdk';
import type {
    TextOptions,
    StreamChunk,
    DefaultMessageMetadataByModality,
} from '@tanstack/ai';
import {
    BaseTextAdapter,
    type TextAdapterConfig,
    type StructuredOutputOptions,
    type StructuredOutputResult,
} from '@tanstack/ai/adapters';

/**
 * Configuration for Anthropic adapter
 */
export interface AnthropicAdapterConfig extends TextAdapterConfig {
    apiKey: string;
    cacheControl?: {
        type?: 'ephemeral' | 'ephemeral-ttl';
        ttlSeconds?: number;
    };
}

/**
 * Anthropic adapter for TanStack AI
 * 
 * Supports prompt caching via cache_control parameter
 */
export class AnthropicTextAdapter extends BaseTextAdapter<
    string,
    Record<string, unknown>,
    readonly ['text'],
    DefaultMessageMetadataByModality
> {
    readonly name = 'anthropic';
    private client: Anthropic;
    private cacheControl?: AnthropicAdapterConfig['cacheControl'];

    constructor(config: AnthropicAdapterConfig, model: string) {
        super(config, model);
        this.client = new Anthropic({ apiKey: config.apiKey });
        this.cacheControl = config.cacheControl || { type: 'ephemeral' };
    }

    /**
     * Stream text completions from Anthropic
     */
    async *chatStream(options: TextOptions<Record<string, unknown>>): AsyncIterable<StreamChunk> {
        const { messages } = options;
        const providerOptions = (options as any).providerOptions;
        const temperature = providerOptions?.temperature ?? 0;
        const top_p = providerOptions?.topP ?? 1;
        const max_tokens = providerOptions?.maxTokens ?? 4000;

        // Separate system and user/assistant messages
        const systemMessages: string[] = [];
        const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        for (const msg of messages) {
            // Handle system messages (they might be passed as 'system' role)
            if ((msg.role as any) === 'system') {
                systemMessages.push(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                conversationMessages.push({
                    role: msg.role,
                    content
                });
            }
        }

        const systemPrompt = systemMessages.join('\n\n');

        try {
            const streamParams: any = {
                model: this.model as string,
                max_tokens: (max_tokens as number) || 4000,
                temperature: (temperature as number) ?? 0,
                top_p: (top_p as number) ?? 1,
                system: systemPrompt || undefined, // Frozen prefix - cached by provider
                messages: conversationMessages, // Variable suffix - processed each time
            };
            
            // Add cache_control if configured (may not be in types yet)
            if (this.cacheControl) {
                streamParams.cache_control = {
                    type: this.cacheControl.type || 'ephemeral',
                    ...(this.cacheControl.ttlSeconds && { ttl_seconds: this.cacheControl.ttlSeconds })
                };
            }
            
            const stream = await this.client.messages.stream(streamParams);

            let accumulated = '';
            let usage: any = null;
            
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    accumulated += event.delta.text;
                    yield {
                        type: 'content',
                        id: '',
                        model: this.model,
                        timestamp: Date.now(),
                        delta: event.delta.text,
                        content: accumulated,
                        role: 'assistant',
                    } as StreamChunk;
                } else if (event.type === 'message_stop') {
                    // Usage is available on the final message
                    usage = (event as any).message?.usage;
                    break;
                } else if ((event as any).type === 'message' || (event as any).message) {
                    // Extract usage from the message event
                    usage = (event as any).message?.usage;
                }
            }
            
            // Send done message with usage
            yield {
                type: 'done',
                id: '',
                model: this.model,
                timestamp: Date.now(),
                finishReason: 'stop',
                usage: usage ? {
                    promptTokens: usage.input_tokens,
                    completionTokens: usage.output_tokens,
                    totalTokens: usage.input_tokens + usage.output_tokens,
                    cacheReadTokens: usage.cache_read_input_tokens || 0,
                    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
                } : undefined,
            } as StreamChunk;
        } catch (error) {
            console.error('[AnthropicAdapter] Stream error:', error);
            throw error;
        }
    }

    /**
     * Non-streaming text completion
     */
    async chat(options: TextOptions<Record<string, unknown>>): Promise<{ text: string; usage?: any }> {
        const { messages } = options;
        const providerOptions = (options as any).providerOptions;
        const temperature = providerOptions?.temperature ?? 0;
        const top_p = providerOptions?.topP ?? 1;
        const max_tokens = providerOptions?.maxTokens ?? 4000;

        // Separate system and user/assistant messages
        const systemMessages: string[] = [];
        const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        for (const msg of messages) {
            // Handle system messages (they might be passed as 'system' role)
            if ((msg.role as any) === 'system') {
                systemMessages.push(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                conversationMessages.push({
                    role: msg.role,
                    content
                });
            }
        }

        const systemPrompt = systemMessages.join('\n\n');

        try {
            const createParams: any = {
                model: this.model as string,
                max_tokens: (max_tokens as number) || 4000,
                temperature: (temperature as number) ?? 0,
                top_p: (top_p as number) ?? 1,
                system: systemPrompt || undefined, // Frozen prefix - cached by provider
                messages: conversationMessages, // Variable suffix - processed each time
            };
            
            // Add cache_control if configured (may not be in types yet)
            if (this.cacheControl) {
                createParams.cache_control = {
                    type: this.cacheControl.type || 'ephemeral',
                    ...(this.cacheControl.ttlSeconds && { ttl_seconds: this.cacheControl.ttlSeconds })
                };
            }
            
            const response = await this.client.messages.create(createParams);

            // Extract text content
            const content = response.content
                .filter(block => block.type === 'text')
                .map(block => (block as { type: 'text'; text: string }).text)
                .join('');

            return {
                text: content,
                usage: response.usage ? {
                    input_tokens: response.usage.input_tokens,
                    output_tokens: response.usage.output_tokens,
                    cache_read_input_tokens: response.usage.cache_read_input_tokens,
                    cache_creation_input_tokens: response.usage.cache_creation_input_tokens
                } : undefined
            };
        } catch (error) {
            console.error('[AnthropicAdapter] Chat error:', error);
            throw error;
        }
    }

    /**
     * Generate structured output
     */
    async structuredOutput(
        options: StructuredOutputOptions<Record<string, unknown>>
    ): Promise<StructuredOutputResult<unknown>> {
        // Use non-streaming chat and parse JSON from response
        const result = await this.chat(options.chatOptions);
        
        // Try to parse as JSON
        let structuredData: unknown;
        try {
            structuredData = JSON.parse(result.text);
        } catch {
            // If parsing fails, return raw text wrapped in an object
            structuredData = { raw: result.text };
        }

        return {
            data: structuredData,
            rawText: result.text,
        };
    }
}

/**
 * Create an Anthropic adapter factory function
 * 
 * @example
 * ```ts
 * const adapter = anthropicText({ apiKey: 'sk-ant-...' });
 * const model = adapter('claude-3-haiku-20240307');
 * ```
 */
export function anthropicText(config: AnthropicAdapterConfig) {
    return (modelId: string) => {
        return new AnthropicTextAdapter(config, modelId);
    };
}

