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

    const { messages, modelId, chatId } = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        modelId?: string;
        chatId?: string;
    };

    // Get UserDO stub
    const userDO = env.USER_DO.get(
        env.USER_DO.idFromName(session.user.id)
    );

    // Get or create chat
    let currentChatId = chatId;
    if (!currentChatId) {
        // Create new chat with title from first user message
        const firstUserMessage = messages.find(m => m.role === 'user')?.content;
        currentChatId = await userDO.createChat(session.user.id, firstUserMessage);
    }

    const tools = createTools(userDO, session.user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiModel = new AIModel(env as any);

    try {
        const stream = await aiModel.streamChat(messages, tools, modelId);
        
        // Create a wrapper stream that saves messages after completion
        const streamWithPersistence = async function* () {
            // Convert input messages to TanStack format for saving
            const messagesToSave: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; [key: string]: unknown }> }> = [];
            
            // Add user messages (from request)
            for (const msg of messages) {
                if (msg.role === 'user') {
                    messagesToSave.push({
                        role: 'user',
                        parts: [{ type: 'text', content: msg.content }],
                    });
                }
            }

            // Collect assistant response as we stream
            const assistantParts: Array<{ type: string; [key: string]: unknown }> = [];
            let currentTextContent = '';

            for await (const chunk of stream) {
                yield chunk;

                // Collect content chunks
                if (chunk.type === 'content') {
                    const contentChunk = chunk as { content?: string; delta?: string };
                    const text = contentChunk.content || contentChunk.delta || '';
                    if (text) {
                        currentTextContent += text;
                    }
                } else if (chunk.type === 'tool_call' || chunk.type === 'tool_result') {
                    // Save accumulated text before tool call/result
                    if (currentTextContent) {
                        assistantParts.push({ type: 'text', content: currentTextContent });
                        currentTextContent = '';
                    }
                    // Collect tool calls and results
                    assistantParts.push({ ...chunk } as { type: string; [key: string]: unknown });
                }
            }

            // Save any remaining text content
            if (currentTextContent) {
                assistantParts.push({ type: 'text', content: currentTextContent });
            }

            // Add assistant message if we collected any parts
            if (assistantParts.length > 0) {
                messagesToSave.push({
                    role: 'assistant',
                    parts: assistantParts,
                });
            }

            // Save all messages after stream completes (fire and forget)
            if (messagesToSave.length > 0) {
                userDO.saveChatMessages(session.user.id, currentChatId, messagesToSave).catch((err) => {
                    console.error('Failed to save chat messages:', err);
                });
            }
        };

        return new Response(toServerSentEventsStream(streamWithPersistence()), {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Chat-Id': currentChatId, // Send chatId in header
            },
        });
    } catch (err: unknown) {
        console.error('Chat error', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal Error';
        return new Response(errorMessage, { status: 500 });
    }
}
