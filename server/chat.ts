import { createAuth } from './auth';
import { createTools } from './tools';
import { AIModel } from './ai-model';

export async function handleChatRequest(request: Request, env: Env) {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { messages, modelId } = await request.json() as { messages: any[], modelId?: string };

    // Get UserTimelineDO stub
    const userTimeline = env.USER_TIMELINE_DO.get(
        env.USER_TIMELINE_DO.idFromName(session.user.id)
    );

    const tools = createTools(userTimeline, session.user.id);

    const aiModel = new AIModel(env);

    try {
        const result = aiModel.streamChat(messages, tools, modelId);
        return result.toTextStreamResponse();
    } catch (err: any) {
        console.error('Chat error', err);
        return new Response(err.message || 'Internal Error', { status: 500 });
    }
}
