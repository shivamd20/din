import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { AIService } from "./ai-service";
import { DEFAULT_MODEL_ID } from "./ai-model";
import { v4 as uuidv4 } from 'uuid';
import type { UserTimelineDO } from "./UserTimelineDO";
import type { UserSignalsDO } from "./UserSignalsDO";
import type { UserCommitmentsDO } from "./UserCommitmentsDO";
import type { UserTasksDO } from "./UserTasksDO";

export interface Env {
    GEMINI_API_KEY: string;
    AI: unknown;
    USER_TIMELINE_DO: DurableObjectNamespace<UserTimelineDO>;
    USER_SIGNALS_DO: DurableObjectNamespace<UserSignalsDO>;
    USER_COMMITMENTS_DO: DurableObjectNamespace<UserCommitmentsDO>;
    USER_TASKS_DO: DurableObjectNamespace<UserTasksDO>;
    FEED_WORKFLOW?: Workflow<{ userId: string; triggerCaptureId?: string }>;
}

export interface WorkflowParams {
    userId: string;
    triggerCaptureId: string;
    windowDays: number;
}

/**
 * Workflow to orchestrate signals, commitments, and tasks generation
 */
export class SignalsWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
    async run(event: Readonly<WorkflowEvent<WorkflowParams>>, step: WorkflowStep): Promise<void> {
        const { userId, triggerCaptureId, windowDays } = event.payload;

        const llmRunId = uuidv4();
        const startTime = Date.now();

        try {
            // Step 1: Fetch captures from UserTimelineDO
            const captures = await step.do(
                "fetch-captures",
                async () => {
                    const timelineDO = this.env.USER_TIMELINE_DO.get(
                        this.env.USER_TIMELINE_DO.idFromName(userId)
                    );
                    const response = await timelineDO.fetch(
                        new Request("https://workflow/internal/get-captures", {
                            method: "POST",
                            body: JSON.stringify({ userId, windowDays }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to fetch captures: ${errorText}`);
                    }
                    const data = await response.json() as { captures: Array<{ id: string; text: string; created_at: number }> };
                    return data.captures;
                }
            );

            if (!captures || captures.length === 0) {
                console.log(`[SignalsWorkflow] No captures found for user ${userId} in ${windowDays} day window`);
                return;
            }

            // Step 2: Call LLM to generate signals, commitments, and tasks
            const llmResult = await step.do(
                "generate-with-llm",
                async () => {
                    // AIService only needs GEMINI_API_KEY and AI from env
                    const aiService = new AIService(this.env as any);
                    return await aiService.generateSignalsCommitmentsTasks(captures, windowDays);
                }
            );

            // Step 3: Persist signals to UserSignalsDO
            await step.do(
                "persist-signals",
                async () => {
                    const signalsDO = this.env.USER_SIGNALS_DO.get(
                        this.env.USER_SIGNALS_DO.idFromName(userId)
                    );
                    const response = await signalsDO.fetch(
                        new Request("https://workflow/internal/add-signals-batch", {
                            method: "POST",
                            body: JSON.stringify({
                                userId,
                                signals: llmResult.signals,
                                model: DEFAULT_MODEL_ID,
                                triggerCaptureId,
                                sourceWindowDays: windowDays,
                                llmRunId,
                            }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to persist signals: ${errorText}`);
                    }
                }
            );

            // Step 4: Persist commitments to UserCommitmentsDO
            await step.do(
                "persist-commitments",
                async () => {
                    const commitmentsDO = this.env.USER_COMMITMENTS_DO.get(
                        this.env.USER_COMMITMENTS_DO.idFromName(userId)
                    );
                    const response = await commitmentsDO.fetch(
                        new Request("https://workflow/internal/add-commitments-batch", {
                            method: "POST",
                            body: JSON.stringify({
                                userId,
                                commitments: llmResult.commitments,
                                triggerCaptureId,
                                sourceWindowDays: windowDays,
                                llmRunId,
                            }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to persist commitments: ${errorText}`);
                    }
                }
            );

            // Step 5: Persist tasks to UserTasksDO
            await step.do(
                "persist-tasks",
                async () => {
                    const tasksDO = this.env.USER_TASKS_DO.get(
                        this.env.USER_TASKS_DO.idFromName(userId)
                    );
                    const response = await tasksDO.fetch(
                        new Request("https://workflow/internal/add-tasks-batch", {
                            method: "POST",
                            body: JSON.stringify({
                                userId,
                                tasks: llmResult.tasks,
                                triggerCaptureId,
                                sourceWindowDays: windowDays,
                                llmRunId,
                            }),
                        })
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to persist tasks: ${errorText}`);
                    }
                }
            );

            const duration = Date.now() - startTime;
            console.log(`[SignalsWorkflow] Successfully processed signals for user ${userId}, duration: ${duration}ms`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[SignalsWorkflow] Failed for user ${userId}:`, errorMessage);
            throw error; // Re-throw to mark workflow as failed
        }
    }
}

