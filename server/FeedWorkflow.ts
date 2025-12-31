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

            // Step 3: Fetch tasks and commitments for LLM linking
            const entityContext = await step.do(
                "fetch-entities",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    const [tasks, commitments] = await Promise.all([
                        userDO.getTasks(userId, { include_history: false }),
                        userDO.getCommitments(userId, { include_history: false })
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
                    
                    // Include all tasks (including completed) for deduplication and suppression
                    // The feed generator will filter completed tasks as needed
                    return {
                        tasks, // Includes both active and completed tasks
                        commitments,
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
            const { items, metrics, commitment_updates } = await step.do(
                "generate-feed",
                async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return await generateFeed(promptStructure, this.env as any, entityContext, currentTime);
                }
            );

            // Step 6: Process commitment updates and auto-completions
            if (commitment_updates && commitment_updates.length > 0) {
                await step.do(
                    "update-commitment-metrics",
                    async () => {
                        const userDO = this.env.USER_DO.get(
                            this.env.USER_DO.idFromName(userId)
                        );
                        
                        for (const update of commitment_updates) {
                            try {
                                // Update metrics
                                await userDO.updateCommitmentMetrics(userId, update.commitment_id, {
                                    health_status: update.status,
                                    streak_count: update.streak_count,
                                    longest_streak: update.longest_streak ?? null,
                                    completion_percentage: update.completion_percentage,
                                    days_since_last_progress: update.days_since_last_progress ?? null,
                                    deadline_risk_score: update.deadline_risk_score ?? null,
                                    consistency_score: update.consistency_score,
                                    momentum_score: update.momentum_score,
                                    engagement_score: update.engagement_score,
                                    user_message: update.user_message,
                                    next_step: update.next_step,
                                    detected_blockers: update.detected_blockers ?? null,
                                    identity_hint: update.identity_hint ?? null
                                });
                                
                                // Auto-complete if detected
                                if (update.should_complete) {
                                    // Create a capture entry documenting the completion
                                    const completionText = `Completed commitment: ${update.user_message || 'Goal achieved'}`;
                                    await userDO.addEntry(userId, completionText, 'system', {
                                        eventType: 'commitment_complete',
                                        linkedCommitmentId: update.commitment_id
                                    });
                                    console.log(`[FeedWorkflow] Auto-completed commitment ${update.commitment_id} for user ${userId}`);
                                }
                            } catch (error) {
                                console.error(`[FeedWorkflow] Failed to update metrics for commitment ${update.commitment_id}:`, error);
                                // Continue with other updates even if one fails
                            }
                        }
                    }
                );
            }

            // Step 7: Persist feed and update last_processed_entry_id
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

            console.log(`[FeedWorkflow] Generated feed for user ${userId}, ${items.length} items, ${commitment_updates?.length || 0} commitment updates, cache hit rate: ${(metrics.cache_hit_rate * 100).toFixed(1)}%`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[FeedWorkflow] Failed for user ${userId}:`, errorMessage);
            throw error; // Re-throw to mark workflow as failed
        }
    }
}

