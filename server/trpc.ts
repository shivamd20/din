import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { type UserTimelineDO } from './UserTimelineDO';

export interface Context {
    userId: string;
    userTimeline: DurableObjectStub<UserTimelineDO>;
}

const t = initTRPC.context<Context>().create();

const AttachmentSchema = z.object({
    id: z.string(),
    key: z.string(),
    type: z.string(),
    mimeType: z.string(),
    name: z.string().optional()
});

const FollowUpSchema = z.object({
    chipId: z.string(),
    chipLabel: z.string(),
    generationId: z.string()
});

const LogCreateInput = z.object({
    entryId: z.string().uuid(),
    text: z.string(),
    attachments: z.array(AttachmentSchema).optional(),
    rootId: z.string().optional(),
    parentId: z.string().optional(),
    followUp: FollowUpSchema.optional()
});

export const appRouter = t.router({
    log: t.router({
        create: t.procedure
            .input(LogCreateInput)
            .mutation(async ({ input, ctx }) => {
                return await ctx.userTimeline.log(input);
            }),

        append: t.procedure
            .input(z.object({
                entryId: z.string(),
                text: z.string()
            }))
            .mutation(async ({ input, ctx }) => {
                return await ctx.userTimeline.append(input);
            }),

        // For debugging/initial load (though we are offline-first, initial pull might be useful)
        getToday: t.procedure
            .query(async ({ ctx }) => {
                return await ctx.userTimeline.getToday();
            }),

        // Sync: Pull recent history
        getRecent: t.procedure
            .input(z.object({
                limit: z.number().min(1).max(100).default(50).optional()
            }).optional())
            .query(async ({ input, ctx }) => {
                const timeline: any = ctx.userTimeline;
                return await timeline.getRecent(input?.limit);
            })
    })
});

export type AppRouter = typeof appRouter;
