import { chat } from '@tanstack/ai';
import { geminiText } from '@tanstack/ai-gemini';
import { SignalSchema, type Signals } from './ai-service';
import { mockText } from './mock-adapter';
import type { AnyTextAdapter } from '@tanstack/ai';

// Centralized model configuration - only Gemini models now
// Using supported model IDs from @tanstack/ai-gemini
export const KNOWN_MODELS = {
    'gemini-2.0-flash': { id: 'gemini-2.0-flash' as const },
    'gemini-2.5-flash': { id: 'gemini-2.5-flash' as const },
} as const;

export type ModelId = keyof typeof KNOWN_MODELS;
export const DEFAULT_MODEL_ID: ModelId = 'gemini-2.0-flash';

export class AIModel {
    private apiKey: string;
    private useMock: boolean;

    constructor(private env: Env & { USE_MOCK_ADAPTER?: string; USE_MOCK_ADAPTER_DEBUG?: string }) {
        this.apiKey = env.GEMINI_API_KEY;
        // Use mock adapter if USE_MOCK_ADAPTER is set to 'true' or if API key is missing
        this.useMock = true
        
        if (this.useMock) {
            console.log('[AIModel] Using mock adapter (offline mode)');
        }
    }

    private getModelId(modelId: string = DEFAULT_MODEL_ID): typeof KNOWN_MODELS[typeof DEFAULT_MODEL_ID]['id'] {
        const config = KNOWN_MODELS[modelId as ModelId];

        if (!config) {
            console.warn(`Unknown model ${modelId}, falling back to default`);
            return KNOWN_MODELS[DEFAULT_MODEL_ID].id;
        }

        return config.id;
    }

    /**
     * Get the appropriate adapter (mock or real)
     */
    getAdapter(modelId?: string): AnyTextAdapter {
        if (this.useMock) {
            // Use default responseGenerator from mock-adapter which handles all cases
            return mockText({
                delay: 100,
                chunkDelay: 30,
                debug: this.env.USE_MOCK_ADAPTER_DEBUG === 'true',
            })('mock-model');
        }

        const id = modelId || DEFAULT_MODEL_ID;
        const model = this.getModelId(id);
        return geminiText(model, { apiKey: this.apiKey });
    }

    /**
     * Extracts structured signals from user text.
     */
    async extractSignals(text: string): Promise<Signals> {
        const adapter = this.getAdapter();

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
     */
    streamChat(messages: Array<{ role: string; content: string }>, tools?: Array<unknown>, modelId?: string) {
        const adapter = this.getAdapter(modelId);

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
