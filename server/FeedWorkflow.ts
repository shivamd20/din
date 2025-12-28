import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import type { UserDO } from "./UserDO";
import { buildCandidates, scoreItems, rankItems } from "./feed-generator";
import { phraseFeedItems } from "./feed-phrasing";

export interface Env {
    GEMINI_API_KEY: string;
    AI: unknown;
    USER_DO: DurableObjectNamespace<UserDO>;
}

export interface FeedWorkflowParams {
    userId: string;
    triggerCaptureId?: string;
}

/**
 * Workflow to generate and materialize the feed
 */
export class FeedWorkflow extends WorkflowEntrypoint<Env, FeedWorkflowParams> {
    async run(event: Readonly<WorkflowEvent<FeedWorkflowParams>>, step: WorkflowStep): Promise<void> {
        const { userId } = event.payload;
        const currentTime = Date.now();

        try {
            // Step 1: Fetch tasks (pending/in_progress) using direct RPC
            const tasks = await step.do(
                "fetch-tasks",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    return await userDO.getTasks(userId, {
                        include_history: false
                    });
                }
            );

            // Step 2: Fetch commitments (active) using direct RPC
            const commitments = await step.do(
                "fetch-commitments",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    return await userDO.getCommitments(userId, {
                        include_history: false
                    });
                }
            );

            // Step 3: Fetch recent signals using direct RPC
            const signals = await step.do(
                "fetch-signals",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    return await userDO.getSignals(userId, {
                        include_history: false,
                        window_days: 30
                    });
                }
            );

            // Step 4: Build candidates
            const candidates = await step.do(
                "build-candidates",
                async () => {
                    return buildCandidates(tasks, commitments, signals);
                }
            );

            if (candidates.length === 0) {
                console.log(`[FeedWorkflow] No candidates found for user ${userId}`);
                // Still save empty feed using direct RPC
                await step.do(
                    "persist-empty-feed",
                    async () => {
                        const userDO = this.env.USER_DO.get(
                            this.env.USER_DO.idFromName(userId)
                        );
                        // Use direct RPC call instead of fetch()
                        const version = await userDO.getNextFeedVersion(userId);
                        await userDO.saveFeedSnapshot(userId, version, []);
                    }
                );
                return;
            }

            // Step 5: Score and rank
            const rankedItems = await step.do(
                "score-and-rank",
                async () => {
                    const scored = scoreItems(candidates, currentTime);
                    return rankItems(scored);
                }
            );

            // Step 6: Call LLM for phrasing
            const phrasedItems = await step.do(
                "phrase-items",
                async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return await phraseFeedItems(rankedItems, currentTime, undefined, this.env as any);
                }
            );

            // Step 7: Persist to UserDO using direct RPC
            await step.do(
                "persist-feed",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    const version = await userDO.getNextFeedVersion(userId);
                    await userDO.saveFeedSnapshot(userId, version, phrasedItems);
                }
            );

            console.log(`[FeedWorkflow] Successfully generated feed for user ${userId}, ${phrasedItems.length} items`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[FeedWorkflow] Failed for user ${userId}:`, errorMessage);
            throw error; // Re-throw to mark workflow as failed
        }
    }
}

