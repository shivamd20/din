import { useChat as useAiChat } from '@ai-sdk/react';

export interface Message {
    id?: string;
    role: 'system' | 'user' | 'assistant' | 'data';
    content: string;
}

export function useChat(options?: any) {
    return useAiChat(options);
}
