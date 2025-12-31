import { CHAT_MESSAGE_QUERIES } from "../queries";

export interface ChatMessage {
    id: string;
    chat_id: string;
    user_id: string;
    role: string; // 'user' | 'assistant'
    content_json: string; // JSON array of message parts
    created_at: number;
    [key: string]: SqlStorageValue;
}

export interface CreateChatMessageParams {
    id: string;
    chatId: string;
    userId: string;
    role: string;
    contentJson: string;
    createdAt: number;
}

/**
 * Data Access Object for Chat Messages
 */
export class ChatMessageDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Create a new chat message
     */
    create(params: CreateChatMessageParams): void {
        this.sql.exec(
            CHAT_MESSAGE_QUERIES.INSERT,
            params.id,
            params.chatId,
            params.userId,
            params.role,
            params.contentJson,
            params.createdAt
        );
    }

    /**
     * Get all messages for a chat (ordered by created_at ASC)
     */
    getByChatId(chatId: string): ChatMessage[] {
        return this.sql.exec<ChatMessage>(CHAT_MESSAGE_QUERIES.GET_BY_CHAT_ID, chatId).toArray();
    }

    /**
     * Delete all messages for a chat
     */
    deleteByChatId(chatId: string): void {
        this.sql.exec(CHAT_MESSAGE_QUERIES.DELETE_BY_CHAT_ID, chatId);
    }

    /**
     * Delete a specific message
     */
    deleteById(messageId: string, chatId: string): void {
        this.sql.exec(CHAT_MESSAGE_QUERIES.DELETE_BY_ID, messageId, chatId);
    }
}

