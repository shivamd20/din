import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import type { UserDO } from './UserDO';

const getRecentLogsParameters = z.object({
    limit: z.number().optional().default(20),
});

const logToTimelineParameters = z.object({
    text: z.string(),
});

// Define tool definitions
const getRecentLogsDef = toolDefinition({
    name: 'getRecentLogs',
    description: 'Get the recent logs/entries from the user\'s timeline. Use this to understand what the user has been doing recently.',
    inputSchema: getRecentLogsParameters,
    outputSchema: z.array(z.any()),
});

const logToTimelineDef = toolDefinition({
    name: 'logToTimeline',
    description: 'Log a new entry to the user\'s timeline. Use this when the user explicitly asks to log something or shares a win/milestone.',
    inputSchema: logToTimelineParameters,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
    }),
});

export const createTools = (userDO: DurableObjectStub<UserDO>, userId: string) => {
    return [
        getRecentLogsDef.server(async (args: { limit?: number }) => {
            const limit = args.limit ?? 20;
            const logs = await userDO.getRecentEntries(limit);
            // Clean logs to remove any non-serializable properties from SQLite result
            return logs.map((l) => ({ ...l }));
        }),
        logToTimelineDef.server(async (args: z.infer<typeof logToTimelineParameters>) => {
            const { text } = args;
            await userDO.addEntry(userId, text, 'chat');
            return { success: true, message: "Logged." };
        }),
    ];
};
