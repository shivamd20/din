import { useChat as useTanstackChat } from '@tanstack/ai-react';
import { fetchServerSentEvents } from '@tanstack/ai-client';
import { useRef, useEffect } from 'react';

export interface Message {
    id?: string;
    role: 'system' | 'user' | 'assistant' | 'data';
    content: string;
}

interface UseChatOptions {
    onError?: (error: Error) => void;
    onFinish?: (message: { role: string; content: string }) => void;
    onResponse?: (response: Response) => void;
    api?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    initialMessages?: Message[];
}

interface TanstackMessage {
    id: string;
    role: 'user' | 'assistant';
    parts: Array<{ type: string; content: string }>;
}

export function useChat(options?: UseChatOptions) {
    const {
        onError,
        onFinish,
        api = '/api/chat',
        body,
        headers,
        initialMessages,
    } = options || {};

    // Convert initial messages format if provided
    const tanstackInitialMessages = initialMessages?.map((msg) => ({
        id: msg.id || crypto.randomUUID(),
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        parts: [{ type: 'text' as const, content: msg.content }],
    })) || [];

    // Create a custom connection that sends messages in the expected format
    const connection = fetchServerSentEvents(api, {
        body: (messages: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; [key: string]: unknown }> }>) => {
            // Convert TanStack messages to the format expected by the server
            const serverMessages = messages.map((msg) => {
                const textParts = msg.parts
                    .filter((part) => part.type === 'text')
                    .map((part) => (part as { type: 'text'; content: string }).content)
                    .join('');
                
                return {
                    role: msg.role,
                    content: textParts,
                };
            });

            return JSON.stringify({
                messages: serverMessages,
                ...body,
            });
        },
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    });

    const {
        messages: tanstackMessages,
        sendMessage: tanstackSendMessage,
        isLoading,
        error,
    } = useTanstackChat({
        connection,
        initialMessages: tanstackInitialMessages,
        onError,
    });

    // Track previous message to detect when a new message is finished
    const prevLastMessageRef = useRef<string>('');

    useEffect(() => {
        if (onFinish && tanstackMessages.length > 0) {
            const lastMessage = tanstackMessages[tanstackMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
                const textParts = lastMessage.parts
                    .filter((part) => part.type === 'text')
                    .map((part) => (part as { type: 'text'; content: string }).content)
                    .join('');
                
                // Only call onFinish if this is a new message or the content changed
                if (textParts !== prevLastMessageRef.current && !isLoading) {
                    prevLastMessageRef.current = textParts;
                    onFinish({
                        role: 'assistant',
                        content: textParts,
                    });
                }
            }
        }
    }, [tanstackMessages, isLoading, onFinish]);

    // Convert TanStack messages to backward-compatible format
    const messages: Message[] = tanstackMessages.map((msg) => {
        // Extract text content from parts
        const textParts = msg.parts
            .filter((part) => part.type === 'text')
            .map((part) => (part as { type: 'text'; content: string }).content)
            .join('');
        
        return {
            id: msg.id,
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: textParts,
        };
    });

    // Convert status to backward-compatible format
    const status = isLoading 
        ? (tanstackMessages.length > 0 && tanstackMessages[tanstackMessages.length - 1]?.role === 'assistant' 
            ? 'streaming' 
            : 'submitted') 
        : 'idle';

    // Wrapper for sendMessage to maintain backward compatibility
    const sendMessage = (input: string | { role: string; content: string }) => {
        let content: string;
        if (typeof input === 'string') {
            content = input;
        } else {
            content = input.content;
        }

        // Call the TanStack sendMessage
        tanstackSendMessage(content).catch((err: Error) => {
            if (onError) {
                onError(err);
            }
        });
    };

    return {
        messages,
        sendMessage,
        status,
        isLoading,
        error,
    };
}
