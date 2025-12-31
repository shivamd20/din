import { chat } from '@tanstack/ai';
import { anthropicText } from './anthropic-adapter';
import { geminiText } from '@tanstack/ai-gemini';
import { SignalSchema, type Signals } from './ai-service';
import type { AnyTextAdapter } from '@tanstack/ai';
import type { z } from 'zod';

// Default models
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-haiku-20240307';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL;

export type Provider = 'anthropic' | 'gemini';

export class AIModel {
    private anthropicApiKeyPromise: Promise<string> | null = null;
    private geminiApiKeyPromise: Promise<string> | null = null;
    private defaultProvider: Provider;

    constructor(private env: Env & { 
        ANTHROPIC_API_KEY?: SecretsStoreSecret | string;
        GEMINI_API_KEY?: SecretsStoreSecret | string | undefined;
        DEFAULT_AI_PROVIDER?: Provider;
    }) {
        // Initialize Anthropic API key if available
        if (env.ANTHROPIC_API_KEY) {
            if (typeof env.ANTHROPIC_API_KEY === 'string') {
                this.anthropicApiKeyPromise = Promise.resolve(env.ANTHROPIC_API_KEY);
            } else {
                this.anthropicApiKeyPromise = env.ANTHROPIC_API_KEY.get();
            }
        }

        // Initialize Gemini API key if available
        const geminiKey: SecretsStoreSecret | string | undefined = env.GEMINI_API_KEY;
        
        if (geminiKey) {
            if (typeof geminiKey === 'string') {
                const trimmed = geminiKey.trim();
                if (trimmed !== '') {
                    this.geminiApiKeyPromise = Promise.resolve(trimmed);
                }
            } else {
                // It's a SecretsStoreSecret
                this.geminiApiKeyPromise = geminiKey.get();
            }
        }

        // Hardcode Gemini as default provider
        this.defaultProvider = env.DEFAULT_AI_PROVIDER || 'gemini';
        
        console.log('[AIModel] Default provider:', this.defaultProvider);
        console.log('[AIModel] Has Gemini key:', !!this.geminiApiKeyPromise);
        console.log('[AIModel] Has Anthropic key:', !!this.anthropicApiKeyPromise);
    }

    /**
     * Get the adapter for the specified provider (or default)
     */
    async getAdapter(modelId?: string, provider?: Provider): Promise<AnyTextAdapter> {
        const selectedProvider = provider || this.defaultProvider;
        console.log('[AIModel] getAdapter - selected provider:', selectedProvider, 'default:', this.defaultProvider);
        
        if (selectedProvider === 'anthropic') {
            if (!this.anthropicApiKeyPromise) {
                throw new Error('ANTHROPIC_API_KEY is not configured');
            }
            const apiKey = await this.anthropicApiKeyPromise;
            const model = modelId || DEFAULT_ANTHROPIC_MODEL;
            return anthropicText({
                apiKey,
                cacheControl: { type: 'ephemeral' }
            })(model) as AnyTextAdapter;
        } else {
            if (!this.geminiApiKeyPromise) {
                throw new Error('GEMINI_API_KEY is not configured');
            }
            const apiKey = await this.geminiApiKeyPromise;
            // geminiText expects specific model types, so we validate or use default
            const validGeminiModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'] as const;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const model = (modelId && validGeminiModels.includes(modelId as any)) 
                ? (modelId as typeof validGeminiModels[number])
                : DEFAULT_GEMINI_MODEL;
            return geminiText(model, { apiKey }) as AnyTextAdapter;
        }
    }

    /**
     * Generate structured output (for feed generation)
     * Uses same chat infrastructure as regular chat
     */
    async generateStructured<T>(
        systemPrompt: string,
        userMessage: string,
        outputSchema: z.ZodSchema<T>,
        options?: {
            temperature?: number;
            topP?: number;
            maxTokens?: number;
            provider?: Provider;
        }
    ): Promise<T> {
        const adapter = await this.getAdapter(undefined, options?.provider);
        
        const result = await chat({
            adapter,
            messages: [
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { role: 'system' as any, content: systemPrompt }, // Frozen prefix - cached
                { role: 'user', content: userMessage } // Variable suffix - processed
            ],
            outputSchema,
            ...(options && {
                providerOptions: {
                    temperature: options.temperature ?? 0, // Default to 0 for determinism
                    topP: options.topP ?? 1, // Default to 1 for determinism
                    maxTokens: options.maxTokens ?? 4000
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        return result as T;
    }

    /**
     * Extracts structured signals from user text.
     */
    async extractSignals(text: string, provider?: Provider): Promise<Signals> {
        const adapter = await this.getAdapter(undefined, provider);

        try {
            const result = await chat({
                adapter,
                messages: [
                    {
                        role: 'user',
                        content: `You extract structured signals from user notes. You never infer intent. You assign probabilities. Return ONLY valid JSON with no markdown formatting or code blocks.\n\nText: ${text}\nReturn JSON with keys:\n- actionability\n- temporal_proximity\n- consequence_strength\n- external_coupling\n- scope_shortness\n- habit_likelihood\n- tone_stress\nEach value must be 0–1.`,
                    },
                ],
                outputSchema: SignalSchema,
            });

            return result;
        } catch (error) {
            console.error('Failed to extract signals:', error);
            // Return default values on error
            return {
                actionability: 0,
                temporal_proximity: 0,
                consequence_strength: 0,
                external_coupling: 0,
                scope_shortness: 0,
                habit_likelihood: 0,
                tone_stress: 0,
            };
        }
    }

    /**
     * Streams a chat response with optional tools.
     * Future: Will support persistent chat
     */
    async streamChat(messages: Array<{ role: string; content: string }>, tools?: Array<unknown>, modelId?: string, provider?: Provider) {
        const adapter = await this.getAdapter(modelId, provider);

        // Convert messages format if needed (from old format to TanStack format)
        const tanstackMessages = messages
            .map((msg) => {
                if (typeof msg === 'string') {
                    return { role: 'user' as const, content: msg };
                }
                if (msg.role === 'system') {
                    // System messages are handled separately
                    return null;
                }
                return {
                    role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
                    content: msg.content || '',
                };
            })
            .filter((msg): msg is { role: 'user' | 'assistant'; content: string } => msg !== null);

        const systemPrompt = `You represent the user's inner voice (the 'Reflect' persona).
- You are gentle, concise, and insightful.
- You help the user identify patterns and feelings.
- You NEVER judge.
- You use short paragraphs.
- IF the user asks to log something explicitly, use the 'logToTimeline' tool.
- IF you need context, use 'getRecentLogs'.`;

        // Prepend system prompt to first user message if no messages exist, or add as first message
        const messagesWithSystem = tanstackMessages.length > 0 && tanstackMessages[0].role === 'user'
            ? [
                {
                    ...tanstackMessages[0],
                    content: `${systemPrompt}\n\n${tanstackMessages[0].content}`,
                },
                ...tanstackMessages.slice(1),
            ]
            : [
                { role: 'user' as const, content: systemPrompt },
                ...tanstackMessages,
            ];

        return chat({
            adapter,
            messages: messagesWithSystem,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: (tools as any) || [],
        });
    }
}
