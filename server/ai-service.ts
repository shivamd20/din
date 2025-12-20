

export class AIService {
    constructor(private ai: Ai) { }

    async generateFollowUp(entryText: string, recentContext: string[] = []): Promise<{ chips: { chipId: string, chipLabel: string, generationId: string }[], analysis?: string, suppressionReason?: string }> {
        if (!this.ai) {
            console.warn("AI binding is undefined. Ensure 'ai' binding is set in wrangler.jsonc and server restarted.");
            return { chips: [], suppressionReason: "AI Binding Missing" };
        }

        // 1. Hard Rules (Pre-computation)
        if (entryText.length > 280) return { chips: [], suppressionReason: "Length > 280" };

        const systemPrompt = `You are a minimalist personal log assistant. Your goal is to help the user capture MISSING objective context (time, place, people, food details) for their log entry.

        Analysis/Reward (ALWAYS provide):
        - Look for a small achievement, positive habit, specific number improvement, or interesting detail.
        - "That's great, 2 more reps than last week!" or "Pizza sounds delicious." or "Consistency is key."
        - Keep it brief (1 short sentence). Be encouraging but not cheesy.
        
        Follow-Up Questions (Always provide at least 1):
        - Prioritize specific questions about missing context (Who? Where? When?).
        - If the entry seems complete or emotional, ask a gentle open-ended question (e.g. "How did you feel?", "Any other details?", "What's next?").
        - Provide 1-4 short, neutral suggestion chips.
        - Chips must be fragments (e.g. "Who with?", "Where?").
        
        Return JSON format:
        {
            "analysis": string, // Short positive/neutral comment.
            "chips": string[] // Must contain at least one string.
        }`;

        const userPrompt = `Prior Context: ${recentContext.join("; ")}\n\nCurrent Entry: "${entryText}"\n\nAnalyze and generate JSON:`;

        try {
            const response: any = await this.ai.run('@cf/meta/llama-3.1-70b-instruct' as any, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' } // Force JSON if supported, or rely on prompt
            });

            // Llama response parsing can be tricky if not strict. 
            // Assuming the model respects JSON mode or prompt strongly.
            let content = response.response;

            // Basic JSON cleanup if needed (sometimes markdown blocks are included)
            if (content.includes('```json')) {
                content = content.split('```json')[1].split('```')[0];
            } else if (content.includes('```')) {
                content = content.split('```')[1].split('```')[0];
            }

            const parsed = JSON.parse(content);

            let rawChips: string[] = parsed.chips?.slice(0, 4) || [];

            // Fallback: Ensure at least one chip exists
            if (rawChips.length === 0) {
                rawChips = ["Anything else?", "How did it feel?"];
            }

            const generationId = crypto.randomUUID();

            const formattedChips = rawChips.map(label => ({
                chipId: crypto.randomUUID(),
                chipLabel: label,
                generationId
            }));

            return {
                chips: formattedChips,
                analysis: parsed.analysis || undefined
            };

        } catch (e) {
            console.error("AI Generation failed", e);
            return { chips: [], suppressionReason: "Error" };
        }
    }
}

