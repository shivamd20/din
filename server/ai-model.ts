import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createWorkersAI } from 'workers-ai-provider';
import { generateObject, streamText, type StreamTextResult } from 'ai';
import { z } from 'zod';
import { SignalSchema, type Signals } from './ai-service';

// Centralized model configuration
export const KNOWN_MODELS = {
    'gemini-2.0-flash-exp': { provider: 'google', id: 'gemini-2.0-flash-exp' },
    'gemini-1.5-flash': { provider: 'google', id: 'gemini-1.5-flash' },
    'llama-3.1-8b': { provider: 'workers-ai', id: '@cf/meta/llama-3.1-8b-instruct' }
} as const;

export type ModelId = keyof typeof KNOWN_MODELS;
export const DEFAULT_MODEL_ID: ModelId = 'llama-3.1-8b';

export class AIModel {
    private google: ReturnType<typeof createGoogleGenerativeAI>;
    private workersAI: ReturnType<typeof createWorkersAI>;

    constructor(private env: Env) {
        this.google = createGoogleGenerativeAI({
            apiKey: env.GEMINI_API_KEY,
        });
        this.workersAI = createWorkersAI({
            binding: env.AI,
        });
    }

    private getModel(modelId: string = DEFAULT_MODEL_ID) {
        const config = KNOWN_MODELS[modelId as ModelId];

        if (!config) {
            console.warn(`Unknown model ${modelId}, falling back to default`);
            const fallback = KNOWN_MODELS[DEFAULT_MODEL_ID];
            if (fallback.provider === 'google') return this.google(fallback.id);
            return this.workersAI(fallback.id as any);
        }

        if (config.provider === 'google') {
            return this.google(config.id);
        }
        return this.workersAI(config.id as any);
    }

    /**
     * Extracts structured signals from user text.
     */
    async extractSignals(text: string): Promise<Signals> {
        // Use a fast, reliable model for signals
        const model = this.getModel(DEFAULT_MODEL_ID);

        const result = await generateObject({
            model,
            schema: SignalSchema,
            system: 'You extract structured signals from user notes. You never infer intent. You assign probabilities.',
            prompt: `Text: ${text}\nReturn JSON with keys:\n- actionability\n- temporal_proximity\n- consequence_strength\n- external_coupling\n- scope_shortness\n- habit_likelihood\n- tone_stress\nEach value must be 0–1.`,
        });

        return result.object;
    }

    /**
     * Streams a chat response with optional tools.
     */
    streamChat(messages: any[], tools?: any, modelId?: string): StreamTextResult<any, any> {
        const id = modelId || DEFAULT_MODEL_ID;
        const model = this.getModel(id);
        const config = KNOWN_MODELS[id as ModelId];

        // Disable tools for Workers AI temporarily for debugging
        const safeTools = config?.provider === 'workers-ai' ? undefined : tools;

        return streamText({
            model,
            system: `You represent the user's inner voice (the 'Reflect' persona).
    - You are gentle, concise, and insightful.
    - You help the user identify patterns and feelings.
    - You NEVER judge.
    - You use short paragraphs.
    - IF the user asks to log something explicitly, use the 'logToTimeline' tool.
    - IF you need context, use 'getRecentLogs'.`,
            messages,
            tools: safeTools,
        });
    }
}
