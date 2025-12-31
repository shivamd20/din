import { z } from 'zod';
import { chat } from '@tanstack/ai';
import { AIModel } from './ai-model';

export const CommitmentsTasksSchema = z.object({
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

export type CommitmentsTasks = z.infer<typeof CommitmentsTasksSchema>;

export const CommitmentDetailsSchema = z.object({
    content: z.string(),
    strength: z.enum(["weak", "medium", "strong"]),
    horizon: z.enum(["short", "medium", "long"]),
    time_horizon_type: z.enum(["date", "daily", "weekly", "monthly", "continuous", "maintain"]).nullable(),
    time_horizon_value: z.number().nullable(), // timestamp if type="date"
    cadence_days: z.number().nullable(), // recurring interval in days
    check_in_method: z.enum(["review", "metric", "reminder", "task_completion"]).nullable(),
    consequence_level: z.enum(["soft", "medium", "hard"]).optional()
});

export type CommitmentDetails = z.infer<typeof CommitmentDetailsSchema>;

export class AIService {
    private model: AIModel;

    constructor(env: Env & { 
        ANTHROPIC_API_KEY?: SecretsStoreSecret | string;
        GEMINI_API_KEY?: SecretsStoreSecret | string;
    }) {
        this.model = new AIModel(env);
    }

    /**
     * Generate commitments and tasks from a window of captures using TanStack AI
     */
    async generateCommitmentsTasks(
        captures: Array<{ id: string; text: string; created_at: number }>,
        windowDays: number
    ): Promise<CommitmentsTasks> {
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
1. Commitments: Identify commitments the user has made, linked to origin_entry_id. Each commitment should have origin_entry_id, strength, horizon, and content (human-readable description).
2. Tasks: Extract actionable tasks with priorities and optional due dates. Each task should have content (human-readable description), optional priority, and optional due_date (timestamp).

Return structured data matching the provided schema.`;

        // Get adapter from model
        const adapter = await this.model.getAdapter();

        try {
            const result = await chat({
                adapter,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                outputSchema: CommitmentsTasksSchema
            });

            return result;
        } catch (error) {
            console.error('Failed to generate commitments/tasks:', error);
            // Retry once
            try {
                const result = await chat({
                    adapter,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    outputSchema: CommitmentsTasksSchema
                });
                return result;
            } catch (retryError) {
                console.error('Retry also failed:', retryError);
                // Return empty structure on failure
                return {
                    commitments: [],
                    tasks: []
                };
            }
        }
    }

    /**
     * Parse commitment details from user text
     * Extracts structured time horizon, strength, horizon, and other metadata
     */
    async parseCommitmentDetails(text: string, feedItemMetadata?: Record<string, unknown>): Promise<CommitmentDetails> {
        const prompt = `You are parsing a commitment confirmation text from a user.

User text: "${text}"

${feedItemMetadata ? `Feed item metadata: ${JSON.stringify(feedItemMetadata)}` : ''}

Extract the following:
1. content: The commitment description (refined from user text or use feed metadata phrasing)
2. strength: weak | medium | strong (based on language certainty)
3. horizon: short | medium | long (based on time frame)
4. time_horizon_type: date | daily | weekly | monthly | continuous | maintain (null if not specified)
5. time_horizon_value: timestamp if type="date", null otherwise
6. cadence_days: number of days for recurring (e.g., 7 for weekly), null if not recurring
7. check_in_method: review | metric | reminder | task_completion (null if not specified)
8. consequence_level: soft | medium | hard (optional)

Parse dates mentioned in the text. If user says "by Friday", calculate the timestamp for the next Friday.
If user says "daily", set time_horizon_type="daily" and cadence_days=1.
If user says "weekly", set time_horizon_type="weekly" and cadence_days=7.
If user says "monthly", set time_horizon_type="monthly" and cadence_days=30.

Return structured data matching the schema.`;

        const adapter = await this.model.getAdapter();

        try {
            const result = await chat({
                adapter,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                outputSchema: CommitmentDetailsSchema
            });

            return result;
        } catch (error) {
            console.error('Failed to parse commitment details:', error);
            // Fallback to basic parsing
            const { parseTimeHorizonFromText } = await import('./time-horizon-parser');
            const timeHorizon = parseTimeHorizonFromText(text);
            
            return {
                content: text,
                strength: feedItemMetadata?.detected_strength as "weak" | "medium" | "strong" || "medium",
                horizon: feedItemMetadata?.detected_horizon as "short" | "medium" | "long" || "medium",
                time_horizon_type: timeHorizon.time_horizon_type,
                time_horizon_value: timeHorizon.time_horizon_value,
                cadence_days: timeHorizon.cadence_days,
                check_in_method: feedItemMetadata?.check_in_method as "review" | "metric" | "reminder" | "task_completion" || null,
                consequence_level: feedItemMetadata?.consequence_level as "soft" | "medium" | "hard" || undefined
            };
        }
    }
}
