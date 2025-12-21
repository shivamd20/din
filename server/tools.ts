import { tool } from 'ai';
import { z } from 'zod';
import { UserTimelineDO } from './UserTimelineDO';

const getRecentLogsParameters = z.object({
    limit: z.number().optional().default(20),
});

const logToTimelineParameters = z.object({
    text: z.string(),
});

export const createTools = (userTimeline: DurableObjectStub<UserTimelineDO>, userId: string) => {
    return {
        getRecentLogs: tool({
            description: 'Get the recent logs/entries from the user\'s timeline. Use this to understand what the user has been doing recently.',
            parameters: getRecentLogsParameters,
            execute: async (args: any) => {
                const { limit } = args;
                const logs = await userTimeline.getRecentEntries(limit);
                // Clean logs to remove any non-serializable properties from SQLite result
                return logs.map(l => ({ ...l }));
            },
        } as any),

        logToTimeline: tool({
            description: 'Log a new entry to the user\'s timeline. Use this when the user explicitly asks to log something or shares a win/milestone.',
            parameters: logToTimelineParameters,
            execute: async (args: any) => {
                const { text } = args;
                await userTimeline.addEntry(userId, text, 'chat');
                return { success: true, message: "Logged." };
            },
        } as any),
    };
};
