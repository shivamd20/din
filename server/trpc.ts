import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { UserTimelineDO } from './UserTimelineDO';


export interface Context {
    userId: string;
    userTimeline: DurableObjectStub<UserTimelineDO>;
}

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
    entries: t.procedure
        .input(z.object({
            text: z.string(),
            source: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const entryId = await ctx.userTimeline.addEntry(ctx.userId, input.text, input.source);
            return { entry_id: entryId };
        }),

    home: t.procedure
        .query(async ({ ctx }) => {
            return await ctx.userTimeline.getHome(ctx.userId);
        }),

    commitments: t.procedure
        .input(z.object({
            entry_id: z.string(),
            strength: z.string(),
            horizon: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const id = await ctx.userTimeline.addCommitment(ctx.userId, input.entry_id, input.strength, input.horizon);
            return { id };
        }),

    // Legacy/Frontend Compatibility Router
    log: t.router({
        create: t.procedure
            .input(z.object({
                entryId: z.string(),
                text: z.string(),
                attachments: z.array(z.any()).optional(),
                rootId: z.string().optional(),
                parentId: z.string().optional(),
                followUp: z.any().optional(), // Provenance data
            }))
            .mutation(async ({ ctx, input }) => {
                // Map legacy input to addEntry options
                const entryId = await ctx.userTimeline.addEntry(ctx.userId, input.text, 'client_sync', {
                    id: input.entryId,
                    attachments: input.attachments,
                    rootId: input.rootId,
                    parentId: input.parentId
                });

                // Return empty structure to satisfy legacy UI
                // If we want to restore follow-ups later, we can hook it here.
                return {
                    entry_id: entryId,
                    followUps: [],
                    analysis: null
                };
            }),

        getRecent: t.procedure
            .input(z.object({
                limit: z.number().optional().default(20),
            }))
            .query(async ({ ctx, input }) => {
                // Fetch raw entries
                const entries = await ctx.userTimeline.getRecentEntries(input.limit);

                // Map to snake_case for frontend
                return entries.map((e: any) => ({
                    entry_id: e.id,
                    created_at: e.created_at,
                    raw_text: e.text,
                    attachments_json: e.attachments_json, // Frontend parses this
                    root_id: e.root_id,
                    parent_id: e.parent_id,
                    // Legacy fields if needed
                }));
            }),
    }),
});

export type AppRouter = typeof appRouter;
