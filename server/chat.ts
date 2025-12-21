import { chat, toServerSentEventsStream } from '@tanstack/ai';
import { geminiText } from '@tanstack/ai-gemini';
import { createAuth } from './auth';

export async function handleChatRequest(request: Request, env: Env) {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await request.json() as { messages: any[] };

    const systemPrompt = `
You are a quiet, reflective companion in a developer's private space.
Your purpose is to help the user reflect on their work, identify patterns, and improve.
This is NOT a conversation. This is a debrief.

Guidelines:
- Be concise. Short messages.
- One idea per message.
- No emojis. No "friendly" chatter.
- Do not be engaging. If the user stops, you stop.
- Focus on clarity.
- Your tone should be calm, professional, and slightly detached but supportive.
- Do not ask open-ended "how can I help" questions.
- If the user says nothing, say nothing or a single very brief prompt.

Examples of good responses:
"What pattern are you noticing?"
"You seem stuck on the implementation details. Step back."
"This matches what you did last week."

Avoid:
"Hi! How are you?"
"That sounds great! Tell me more!"
"Here is a summary of what you said."
  `.trim();

    try {
        const stream = chat({
            adapter: geminiText('gemini-2.5-flash', {
                apiKey: env.GEMINI_API_KEY
            }),
            messages,
            systemPrompts: [systemPrompt],
        });

        const readableStream = toServerSentEventsStream(stream);

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    } catch (err: any) {
        console.error('Chat error', err);
        return new Response(err.message || 'Internal Error', { status: 500 });
    }
}

