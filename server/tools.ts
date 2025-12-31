import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import type { UserDO } from './UserDO';

// Tool schemas
const getEntriesParameters = z.object({
    limit: z.number().optional().describe('Maximum number of entries to return'),
    userId: z.string().optional().describe('User ID (automatically provided)'),
});

const getTasksParameters = z.object({
    status: z.string().optional().describe('Filter by task status (planned, started, paused, completed, abandoned)'),
    include_history: z.boolean().optional().default(false).describe('Include historical task versions'),
    userId: z.string().optional().describe('User ID (automatically provided)'),
});

const getCommitmentsParameters = z.object({
    status: z.string().optional().describe('Filter by commitment status (confirmed, active, completed, retired, renegotiated)'),
    include_history: z.boolean().optional().default(false).describe('Include historical commitment versions'),
    userId: z.string().optional().describe('User ID (automatically provided)'),
});

// Tool definitions
const getEntriesDef = toolDefinition({
    name: 'getEntries',
    description: 'Get captured entries (thoughts/captures) from the user\'s timeline. Use this to understand what the user has captured recently or historically.',
    inputSchema: getEntriesParameters,
    outputSchema: z.array(z.any()),
});

const getTasksDef = toolDefinition({
    name: 'getTasks',
    description: 'Get tasks (explicit or extrapolated) from the user\'s system. Use this to see what tasks exist, their status, and related commitments.',
    inputSchema: getTasksParameters,
    outputSchema: z.array(z.any()),
});

const getCommitmentsDef = toolDefinition({
    name: 'getCommitments',
    description: 'Get commitments (active, paused, completed, canceled) from the user\'s system. Use this to see commitments, their health status, streaks, and blockers.',
    inputSchema: getCommitmentsParameters,
    outputSchema: z.array(z.any()),
});

export const createTools = (userDO: DurableObjectStub<UserDO>, userId: string) => {
    return [
        getEntriesDef.server(async (args: { limit?: number }) => {
            const limit = args.limit ?? 50;
            // Get all entries for the user, then limit
            const entries = await userDO.getAllEntries(userId);
            // Return most recent entries first, limited to requested amount
            const sorted = entries.sort((a, b) => b.created_at - a.created_at);
            return sorted.slice(0, limit).map((e) => ({ ...e }));
        }),
        getTasksDef.server(async (args: { status?: string; include_history?: boolean }) => {
            const tasks = await userDO.getTasks(userId, {
                status: args.status,
                include_history: args.include_history ?? false,
            });
            // Clean tasks to remove any non-serializable properties
            return tasks.map((t) => ({ ...t }));
        }),
        getCommitmentsDef.server(async (args: { status?: string; include_history?: boolean }) => {
            const commitments = await userDO.getCommitments(userId, {
                status: args.status,
                include_history: args.include_history ?? false,
            });
            // Clean commitments to remove any non-serializable properties
            return commitments.map((c) => ({ ...c }));
        }),
    ];
};
