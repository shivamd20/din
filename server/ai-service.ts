import { z } from 'zod';
import { AIModel } from './ai-model';

export const SignalSchema = z.object({
    actionability: z.number().min(0).max(1),
    temporal_proximity: z.number().min(0).max(1),
    consequence_strength: z.number().min(0).max(1),
    external_coupling: z.number().min(0).max(1),
    scope_shortness: z.number().min(0).max(1),
    habit_likelihood: z.number().min(0).max(1),
    tone_stress: z.number().min(0).max(1),
});

export type Signals = z.infer<typeof SignalSchema>;

export class AIService {
    private model: AIModel;

    constructor(env: Env) {
        this.model = new AIModel(env);
    }

    async extractSignals(text: string): Promise<Signals> {
        return this.model.extractSignals(text);
    }
}
