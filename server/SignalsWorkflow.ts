import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { AIService } from "./ai-service";
import { DEFAULT_MODEL_ID } from "./ai-model";
import { v4 as uuidv4 } from 'uuid';
import type { UserDO } from "./UserDO";

export interface Env {
    GEMINI_API_KEY: string;
    AI: unknown;
    USER_DO: DurableObjectNamespace<UserDO>;
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
            // Step 1: Fetch captures from UserDO using direct RPC
            const captures = await step.do(
                "fetch-captures",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    return await userDO.getCapturesForWindow(userId, windowDays);
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const aiService = new AIService(this.env as any);
                    return await aiService.generateSignalsCommitmentsTasks(captures, windowDays);
                }
            );

            // Step 3: Persist signals to UserDO using direct RPC
            await step.do(
                "persist-signals",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    await userDO.addSignalsBatch(
                        userId,
                        llmResult.signals,
                        DEFAULT_MODEL_ID,
                        triggerCaptureId,
                        windowDays,
                        llmRunId
                    );
                }
            );

            // Step 4: Persist commitments to UserDO using direct RPC
            await step.do(
                "persist-commitments",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    await userDO.addCommitmentsBatch(
                        userId,
                        llmResult.commitments,
                        triggerCaptureId,
                        windowDays,
                        llmRunId
                    );
                }
            );

            // Step 5: Persist tasks to UserDO using direct RPC
            await step.do(
                "persist-tasks",
                async () => {
                    const userDO = this.env.USER_DO.get(
                        this.env.USER_DO.idFromName(userId)
                    );
                    // Use direct RPC call instead of fetch()
                    await userDO.addTasksBatch(
                        userId,
                        llmResult.tasks,
                        triggerCaptureId,
                        windowDays,
                        llmRunId
                    );
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

