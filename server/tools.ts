import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import { UserTimelineDO } from './UserTimelineDO';

export const createTools = (userTimeline: DurableObjectStub<UserTimelineDO>) => {
    const getRecentLogs = toolDefinition({
        name: 'getRecentLogs',
        description: 'Get the recent logs/entries from the user\'s timeline.',
        inputSchema: z.object({
            limit: z.number().optional().default(20),
        }),
    }).server(async ({ limit }) => {
        // Cast to any to avoid deep type instantiation issues with DurableObjectStub
        const logs = await (userTimeline as any).getRecent(limit);
        return logs as any;
    });

    const logToTimeline = toolDefinition({
        name: 'logToTimeline',
        description: 'Log a new entry to the user\'s timeline.',
        inputSchema: z.object({
            text: z.string(),
        }),
    }).server(async ({ text }) => {
        const entryId = crypto.randomUUID();
        await userTimeline.log({
            entryId,
            text,
        });
        return { success: true, message: "Logged." };
    });

    return [getRecentLogs, logToTimeline];
};
