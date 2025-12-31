import { v4 as uuidv4 } from 'uuid';
import { ChatDAO, type CreateChatParams, type UpdateChatTitleParams } from '../db/daos/ChatDAO';
import { ChatMessageDAO, type CreateChatMessageParams } from '../db/daos/ChatMessageDAO';

/**
 * Service layer for Chat business logic
 */
export class ChatService {
    constructor(
        private chatDAO: ChatDAO,
        private chatMessageDAO: ChatMessageDAO
    ) {}

    /**
     * Generate title from first user message
     */
    private generateTitle(firstUserMessage: string): string {
        // Extract text from message (could be plain text or JSON)
        let text = firstUserMessage;
        try {
            const parsed = JSON.parse(firstUserMessage);
            if (Array.isArray(parsed)) {
                // TanStack AI message parts format
                const textParts = parsed
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.content || '')
                    .join('');
                text = textParts || firstUserMessage;
            } else if (typeof parsed === 'object' && parsed.content) {
                text = parsed.content;
            }
        } catch {
            // Not JSON, use as-is
        }

        // Clean up and truncate
        const cleaned = text.trim().replace(/\s+/g, ' ');
        const firstLine = cleaned.split('\n')[0];
        const truncated = firstLine.length > 50 
            ? firstLine.substring(0, 47).trim() + '...'
            : firstLine;
        
        return truncated || 'New Chat';
    }

    /**
     * Create a new chat with auto-generated title
     */
    createChat(userId: string, firstUserMessage?: string): string {
        const chatId = uuidv4();
        const now = Date.now();
        const title = firstUserMessage 
            ? this.generateTitle(firstUserMessage)
            : 'New Chat';

        const params: CreateChatParams = {
            id: chatId,
            userId,
            title,
            createdAt: now,
            updatedAt: now,
        };

        this.chatDAO.create(params);
        return chatId;
    }

    /**
     * Get chat with all messages
     */
    getChatWithMessages(chatId: string, userId: string): { chat: any; messages: any[] } | null {
        const chat = this.chatDAO.getById(chatId, userId);
        if (!chat) {
            return null;
        }

        const messages = this.chatMessageDAO.getByChatId(chatId);
        
        // Parse message content JSON
        const parsedMessages = messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            parts: JSON.parse(msg.content_json),
            createdAt: msg.created_at,
        }));

        return {
            chat,
            messages: parsedMessages,
        };
    }

    /**
     * List all chats for a user
     */
    listChats(userId: string): any[] {
        return this.chatDAO.listByUser(userId);
    }

    /**
     * Update chat title
     */
    updateChatTitle(chatId: string, userId: string, title: string): void {
        const params: UpdateChatTitleParams = {
            chatId,
            userId,
            title: title.trim() || 'New Chat',
            updatedAt: Date.now(),
        };
        this.chatDAO.updateTitle(params);
    }

    /**
     * Delete a chat and all its messages
     */
    deleteChat(chatId: string, userId: string): void {
        // Delete messages first (CASCADE should handle this, but being explicit)
        this.chatMessageDAO.deleteByChatId(chatId);
        // Delete chat
        this.chatDAO.delete(chatId, userId);
    }

    /**
     * Save a message to a chat
     */
    saveMessage(
        chatId: string,
        userId: string,
        role: 'user' | 'assistant',
        parts: Array<{ type: string; [key: string]: unknown }>
    ): string {
        const messageId = uuidv4();
        const now = Date.now();
        const contentJson = JSON.stringify(parts);

        const params: CreateChatMessageParams = {
            id: messageId,
            chatId,
            userId,
            role,
            contentJson,
            createdAt: now,
        };

        this.chatMessageDAO.create(params);
        
        // Update chat's updated_at timestamp
        this.chatDAO.updateUpdatedAt(chatId, userId, now);

        return messageId;
    }

    /**
     * Save multiple messages at once (for auto-save after assistant response)
     */
    saveMessages(
        chatId: string,
        userId: string,
        messages: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; [key: string]: unknown }> }>
    ): void {
        const now = Date.now();
        
        for (const msg of messages) {
            const messageId = uuidv4();
            const contentJson = JSON.stringify(msg.parts);

            const params: CreateChatMessageParams = {
                id: messageId,
                chatId,
                userId,
                role: msg.role,
                contentJson,
                createdAt: now,
            };

            this.chatMessageDAO.create(params);
        }

        // Update chat's updated_at timestamp
        this.chatDAO.updateUpdatedAt(chatId, userId, now);
    }
}

