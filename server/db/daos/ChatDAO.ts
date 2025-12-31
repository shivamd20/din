import { CHAT_QUERIES } from "../queries";

export interface Chat {
    id: string;
    user_id: string;
    title: string;
    created_at: number;
    updated_at: number;
    [key: string]: SqlStorageValue;
}

export interface CreateChatParams {
    id: string;
    userId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export interface UpdateChatTitleParams {
    chatId: string;
    userId: string;
    title: string;
    updatedAt: number;
}

/**
 * Data Access Object for Chats
 */
export class ChatDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Create a new chat
     */
    create(params: CreateChatParams): void {
        this.sql.exec(
            CHAT_QUERIES.INSERT,
            params.id,
            params.userId,
            params.title,
            params.createdAt,
            params.updatedAt
        );
    }

    /**
     * Get chat by ID
     */
    getById(chatId: string, userId: string): Chat | null {
        const result = this.sql.exec<Chat>(CHAT_QUERIES.GET_BY_ID, chatId, userId).one();
        return result || null;
    }

    /**
     * List all chats for a user (ordered by updated_at DESC)
     */
    listByUser(userId: string): Chat[] {
        return this.sql.exec<Chat>(CHAT_QUERIES.LIST_BY_USER, userId).toArray();
    }

    /**
     * Update chat title
     */
    updateTitle(params: UpdateChatTitleParams): void {
        this.sql.exec(
            CHAT_QUERIES.UPDATE_TITLE,
            params.title,
            params.updatedAt,
            params.chatId,
            params.userId
        );
    }

    /**
     * Update chat's updated_at timestamp
     */
    updateUpdatedAt(chatId: string, userId: string, updatedAt: number): void {
        this.sql.exec(CHAT_QUERIES.UPDATE_UPDATED_AT, updatedAt, chatId, userId);
    }

    /**
     * Delete a chat
     */
    delete(chatId: string, userId: string): void {
        this.sql.exec(CHAT_QUERIES.DELETE, chatId, userId);
    }
}

