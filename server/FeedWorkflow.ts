import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import type { UserDO } from "./UserDO";
import { buildPrompt } from "./prompt-builder";
import { generateFeed } from "./llm-feed-generator";

export interface Env {
    ANTHROPIC_API_KEY?: SecretsStoreSecret | string;
    GEMINI_API_KEY?: SecretsStoreSecret | string;
    AI: unknown;
    USER_DO: DurableObjectNamespace<UserDO>;
}

export interface FeedWorkflowParams {
    userId: string;
    triggerCaptureId?: string;
}

/**
 * Workflow to generate and materialize the feed using LLM-first approach
 */
export class FeedWorkflow extends WorkflowEntrypoint<Env, FeedWorkflowParams> {
    async run(event: Readonly<WorkflowEvent<FeedWorkflowParams>>, step: WorkflowStep): Promise<void> {
        const { userId } = event.payload;
        const currentTime = Date.now();

        try {
            // Step 1: Fetch all entries
            const allEntries = await step.do(
                "fetch-entries",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    return await userDO.getAllEntries(userId);
                }
            );

            // Step 2: Get last processed entry ID from last feed generation
            const lastProcessedEntryId = await step.do(
                "get-last-processed",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    return await userDO.getLastProcessedEntryId(userId);
                }
            );

            // Step 3: Fetch tasks, commitments, and signals for LLM linking
            const entityContext = await step.do(
                "fetch-entities",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    const [tasks, commitments, signals] = await Promise.all([
                        userDO.getTasks(userId, { include_history: false }),
                        userDO.getCommitments(userId, { include_history: false }),
                        userDO.getSignals(userId, { include_history: false })
                    ]);
                    
                    // Determine time of day context
                    const hour = new Date(currentTime).getHours();
                    let timeOfDay: string;
                    if (hour >= 5 && hour < 12) {
                        timeOfDay = 'morning';
                    } else if (hour >= 12 && hour < 17) {
                        timeOfDay = 'afternoon';
                    } else if (hour >= 17 && hour < 21) {
                        timeOfDay = 'evening';
                    } else {
                        timeOfDay = 'night';
                    }
                    
                    return {
                        tasks,
                        commitments,
                        signals,
                        timeOfDay
                    };
                }
            );

            // Step 4: Build prompt structure (70-90% prefix, 10-30% suffix)
            const promptStructure = await step.do(
                "build-prompt",
                async () => {
                    return buildPrompt(allEntries, lastProcessedEntryId, currentTime, entityContext);
                }
            );

            // Step 5: Generate feed with LLM (Anthropic with prompt caching)
            const { items, metrics } = await step.do(
                "generate-feed",
                async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return await generateFeed(promptStructure, this.env as any);
                }
            );

            // Step 6: Persist feed and update last_processed_entry_id
            await step.do(
                "persist-feed",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    const version = await userDO.getNextFeedVersion(userId);
                    
                    // Determine last processed entry ID
                    const newLastProcessedEntryId = allEntries.length > 0 
                        ? allEntries[allEntries.length - 1].id 
                        : lastProcessedEntryId;
                    
                    await userDO.saveFeedSnapshot(userId, version, items, {
                        lastProcessedEntryId: newLastProcessedEntryId,
                        cacheMetrics: metrics as unknown as Record<string, unknown>
                    });
                }
            );

            console.log(`[FeedWorkflow] Generated feed for user ${userId}, ${items.length} items, cache hit rate: ${(metrics.cache_hit_rate * 100).toFixed(1)}%`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[FeedWorkflow] Failed for user ${userId}:`, errorMessage);
            throw error; // Re-throw to mark workflow as failed
        }
    }
}

