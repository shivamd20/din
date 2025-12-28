import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import type { UserTimelineDO } from "./UserTimelineDO";
import type { UserSignalsDO } from "./UserSignalsDO";
import type { UserCommitmentsDO } from "./UserCommitmentsDO";
import type { UserTasksDO } from "./UserTasksDO";
import type { UserFeedDO } from "./UserFeedDO";
import { buildCandidates, scoreItems, rankItems, prepareLLMRequest } from "./feed-generator";
import { phraseFeedItems } from "./feed-phrasing";

export interface Env {
    GEMINI_API_KEY: string;
    AI: unknown;
    USER_TIMELINE_DO: DurableObjectNamespace<UserTimelineDO>;
    USER_SIGNALS_DO: DurableObjectNamespace<UserSignalsDO>;
    USER_COMMITMENTS_DO: DurableObjectNamespace<UserCommitmentsDO>;
    USER_TASKS_DO: DurableObjectNamespace<UserTasksDO>;
    USER_FEED_DO: DurableObjectNamespace<UserFeedDO>;
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
        const { userId, triggerCaptureId } = event.payload;
        const startTime = Date.now();
        const currentTime = Date.now();

        try {
            // Step 1: Fetch tasks (pending/in_progress)
            const tasks = await step.do(
                "fetch-tasks",
                async () => {
                    const tasksDO = this.env.USER_TASKS_DO.get(
                        this.env.USER_TASKS_DO.idFromName(userId)
                    );
                    const response = await tasksDO.fetch(
                        new Request("https://workflow/internal/get-tasks", {
                            method: "POST",
                            body: JSON.stringify({ userId }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to fetch tasks: ${errorText}`);
                    }
                    const data = await response.json() as { tasks: Array<{
                        id: string;
                        content: string;
                        status: string;
                        priority?: string | null;
                        due_date?: number | null;
                        created_at: number;
                    }> };
                    return data.tasks;
                }
            );

            // Step 2: Fetch commitments (active)
            const commitments = await step.do(
                "fetch-commitments",
                async () => {
                    const commitmentsDO = this.env.USER_COMMITMENTS_DO.get(
                        this.env.USER_COMMITMENTS_DO.idFromName(userId)
                    );
                    const response = await commitmentsDO.fetch(
                        new Request("https://workflow/internal/get-commitments", {
                            method: "POST",
                            body: JSON.stringify({ userId }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to fetch commitments: ${errorText}`);
                    }
                    const data = await response.json() as { commitments: Array<{
                        id: string;
                        content: string;
                        strength: string;
                        horizon: string;
                        status: string;
                        created_at: number;
                    }> };
                    return data.commitments;
                }
            );

            // Step 3: Fetch recent signals
            const signals = await step.do(
                "fetch-signals",
                async () => {
                    const signalsDO = this.env.USER_SIGNALS_DO.get(
                        this.env.USER_SIGNALS_DO.idFromName(userId)
                    );
                    const response = await signalsDO.fetch(
                        new Request("https://workflow/internal/get-signals", {
                            method: "POST",
                            body: JSON.stringify({ userId }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to fetch signals: ${errorText}`);
                    }
                    const data = await response.json() as { signals: Array<{
                        id: string;
                        entry_id: string;
                        key: string;
                        value: number;
                        confidence: number;
                        generated_at: number;
                    }> };
                    return data.signals;
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
                // Still save empty feed
                await step.do(
                    "persist-empty-feed",
                    async () => {
                        const feedDO = this.env.USER_FEED_DO.get(
                            this.env.USER_FEED_DO.idFromName(userId)
                        );
                        const response = await feedDO.fetch(
                            new Request("https://workflow/internal/save-feed", {
                                method: "POST",
                                body: JSON.stringify({ userId, items: [] }),
                            })
                        );
                        if (!response.ok) {
                            throw new Error(`Failed to persist feed: ${await response.text()}`);
                        }
                    }
                );
                return;
            }

            // Step 5: Score and rank
            const scoredItems = await step.do(
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
                    return await phraseFeedItems(scoredItems, currentTime, undefined, this.env as any);
                }
            );

            // Step 7: Persist to UserFeedDO
            await step.do(
                "persist-feed",
                async () => {
                    const feedDO = this.env.USER_FEED_DO.get(
                        this.env.USER_FEED_DO.idFromName(userId)
                    );
                    const response = await feedDO.fetch(
                        new Request("https://workflow/internal/save-feed", {
                            method: "POST",
                            body: JSON.stringify({ userId, items: phrasedItems }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to persist feed: ${errorText}`);
                    }
                }
            );

            const duration = Date.now() - startTime;
            console.log(`[FeedWorkflow] Successfully generated feed for user ${userId}, ${phrasedItems.length} items, duration: ${duration}ms`);

        } catch (error: unknown) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[FeedWorkflow] Failed for user ${userId}:`, errorMessage);
            throw error; // Re-throw to mark workflow as failed
        }
    }
}

