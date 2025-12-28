import { z } from 'zod';
import { chat } from '@tanstack/ai';
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

export const SignalsCommitmentsTasksSchema = z.object({
    signals: z.array(z.object({
        entry_id: z.string(),
        key: z.string(),
        value: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1)
    })),
    commitments: z.array(z.object({
        origin_entry_id: z.string(),
        strength: z.string(),
        horizon: z.string(),
        content: z.string()
    })),
    tasks: z.array(z.object({
        content: z.string(),
        priority: z.string().optional(),
        due_date: z.number().optional()
    }))
});

export type SignalsCommitmentsTasks = z.infer<typeof SignalsCommitmentsTasksSchema>;

export class AIService {
    private model: AIModel;

    constructor(env: Env) {
        this.model = new AIModel(env);
    }

    async extractSignals(text: string): Promise<Signals> {
        return this.model.extractSignals(text);
    }

    /**
     * Generate signals, commitments, and tasks from a window of captures using TanStack AI
     */
    async generateSignalsCommitmentsTasks(
        captures: Array<{ id: string; text: string; created_at: number }>,
        windowDays: number
    ): Promise<SignalsCommitmentsTasks> {
        // Format captures chronologically for the prompt
        const formattedCaptures = captures
            .sort((a, b) => a.created_at - b.created_at)
            .map((capture, idx) => {
                const date = new Date(capture.created_at).toISOString();
                return `[Capture ${idx + 1} - ID: ${capture.id} - Date: ${date}]\n${capture.text}`;
            })
            .join('\n\n---\n\n');

        const prompt = `You are analyzing user captures from the past ${windowDays} days.
Given the following captures in chronological order:

${formattedCaptures}

Generate:
1. Signals: Extract signal values (actionability, temporal_proximity, consequence_strength, external_coupling, scope_shortness, habit_likelihood, tone_stress) for each capture entry_id. Each signal should have entry_id, key, value (0-1), and confidence (0-1).
2. Commitments: Identify commitments the user has made, linked to origin_entry_id. Each commitment should have origin_entry_id, strength, horizon, and content (human-readable description).
3. Tasks: Extract actionable tasks with priorities and optional due dates. Each task should have content (human-readable description), optional priority, and optional due_date (timestamp).

Return structured data matching the provided schema.`;

        // Get adapter from model
        const adapter = this.model.getAdapter();

        try {
            const result = await chat({
                adapter,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                outputSchema: SignalsCommitmentsTasksSchema
            });

            return result;
        } catch (error) {
            console.error('Failed to generate signals/commitments/tasks:', error);
            // Retry once
            try {
                const result = await chat({
                    adapter,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    outputSchema: SignalsCommitmentsTasksSchema
                });
                return result;
            } catch (retryError) {
                console.error('Retry also failed:', retryError);
                // Return empty structure on failure
                return {
                    signals: [],
                    commitments: [],
                    tasks: []
                };
            }
        }
    }
}
