import { toServerSentEventsStream } from '@tanstack/ai';
import { createAuth } from './auth';
import { createTools } from './tools';
import { AIModel } from './ai-model';

export async function handleChatRequest(request: Request, env: Env) {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { messages, modelId } = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        modelId?: string;
    };

    // Get UserTimelineDO stub
    const userTimeline = env.USER_TIMELINE_DO.get(
        env.USER_TIMELINE_DO.idFromName(session.user.id)
    );

    const tools = createTools(userTimeline, session.user.id);

    const aiModel = new AIModel(env);

    try {
        const stream = aiModel.streamChat(messages, tools, modelId);
        return new Response(toServerSentEventsStream(stream), {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err: unknown) {
        console.error('Chat error', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal Error';
        return new Response(errorMessage, { status: 500 });
    }
}
