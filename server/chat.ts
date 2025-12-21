import { chat, toServerSentEventsStream } from '@tanstack/ai';
import { geminiText } from '@tanstack/ai-gemini';
import { createAuth } from './auth';
import { createTools } from './tools';

export async function handleChatRequest(request: Request, env: Env) {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await request.json() as { messages: any[] };

    // Get UserTimelineDO stub
    const userTimeline = env.USER_TIMELINE_DO.get(
        env.USER_TIMELINE_DO.idFromName(session.user.id)
    );

    const tools = createTools(userTimeline);

    const systemPrompt = `
You are a supportive, insightful, and reflective AI companion.
Your goal is to help the user achieve their goals, understand their patterns, and navigate their day.
This is a safe space. The user can share anything: stress, wins, detailed logging, or random thoughts.

Guidelines:
- **Context Aware**: Use the \`getRecentLogs\` tool to understand what the user has been doing recently. Do this early if the user refers to past events.
- **Supportive & Proactive**: Ask about their stress levels, reps, or specific details if relevant to their goals.
- **Logging**: If the user shares something significant (a win, a realization, a completed task, a noteworthy event), use the \`logToTimeline\` tool to save it. Explicitly tell the user when you log something.
- **Tone**: Professional yet warm. High agency. "Premium" feel - concise, articulate, and thoughtful.
- **Privacy**: Assure them this is their private space if they seem hesitant.

Do NOT:
- Be overly verbose.
- Use generic platitudes.
- Log trivial "hello" messages.

Always default to being helpful and clearing the fog for the user.
`.trim();

    try {
        const stream = chat({
            adapter: geminiText('gemini-2.5-flash', {
                apiKey: env.GEMINI_API_KEY
            }),
            messages,
            systemPrompts: [systemPrompt],
            tools,
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

