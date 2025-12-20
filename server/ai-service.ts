

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

        Strict Suppression Rules (Do NOT ask *Follow-Up Questions* if):
        - The entry effectively describes "what happened" already.
        - The entry is emotional, venting, or introspective.
        - The entry has > 2 factual clauses (e.g. "I ate pizza with John at home" -> has what, who, where -> SUPPRESS questions).
        - The user seems tired or rushed (short, vague words).

        Analysis/Reward (ALWAYS provide if positive/neutral):
        - Look for a small achievement, positive habit, specific number improvement, or interesting detail.
        - "That's great, 2 more reps than last week!" or "Pizza sounds delicious." or "Consistency is key."
        - Keep it brief (1 short sentence). Be encouraging but not cheesy.
        
        If you decide to ask Follow-Up Questions:
        - Provide 1-4 short, neutral suggestion chips.
        - Chips must be fragments (e.g. "Who with?", "Where?", "What time?").
        - NEVER be conversational in the chips.
        
        Return JSON format:
        {
            "suppressed": boolean, // true if NO follow-up questions should be asked.
            "reason": string,
            "analysis": string, // Short positive/neutral comment.
            "chips": string[]
        }`;

        const userPrompt = `Prior Context: ${recentContext.join("; ")}\n\nCurrent Entry: "${entryText}"\n\nAnalyze and generate JSON:`;

        try {
            const response: any = await this.ai.run('@cf/meta/llama-3-3-70b-instruct' as any, {
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

            // If suppressed, we might still want the analysis if available?
            // The caller handles logic. We just return what we got.
            // If suppressed, chips are empty.

            const rawChips: string[] = parsed.chips?.slice(0, 4) || [];
            if (parsed.suppressed) {
                // If suppressed, return empty chips but include analysis if present
                return {
                    chips: [],
                    analysis: parsed.analysis || undefined,
                    suppressionReason: parsed.reason
                };
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

