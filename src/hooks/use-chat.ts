import { useState, useRef, useCallback } from 'react';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
}

export function useChat({ api = '/api/chat', initialMessages = [] }: { api?: string, initialMessages?: Message[] } = {}) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const append = useCallback(async (message: Message) => {
        setMessages(prev => [...prev, message]);
        setIsLoading(true);

        try {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            const response = await fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, message] }),
                signal: abortController.signal,
            });

            if (!response.ok) throw new Error('Failed to send message');
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage: Message = { role: 'assistant', content: '', id: crypto.randomUUID() };

            setMessages(prev => [...prev, assistantMessage]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(data);
                            // Check what format 'toStreamResponse' sends.
                            // StreamChunk usually has { type: 'content', delta: string }
                            if (parsed.type === 'content' && parsed.delta) {
                                assistantMessage = {
                                    ...assistantMessage,
                                    content: assistantMessage.content + parsed.delta
                                };
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1] = assistantMessage;
                                    return newMsgs;
                                });
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data', data);
                        }
                    }
                }
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Chat error', err);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [api, messages]);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    return {
        messages,
        input,
        setInput,
        append,
        isLoading,
        stop
    };
}
