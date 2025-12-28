import { DurableObject } from "cloudflare:workers";
import type { WorkflowParams } from "./SignalsWorkflow";
import { SCHEMA_QUERIES } from "./db/queries";
import {
    EntryDAO,
    SignalDAO,
    CommitmentDAO,
    TaskDAO,
    FeedDAO,
    type Signal,
    type Commitment,
    type Task,
} from "./db/daos";
import {
    EntryService,
    SignalService,
    CommitmentService,
    TaskService,
    FeedService,
} from "./services";

// ============================================================================
// FeedItemRendered Type
// ============================================================================

export interface FeedItemRendered {
    id: string;
    phrasing: string;
    supporting_note?: string;
    suggested_actions: Array<{ action: string; label: string }>;
}

export interface Env {
    GEMINI_API_KEY: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AI: any;
    SIGNALS_WORKFLOW?: Workflow<WorkflowParams>;
    FEED_WORKFLOW?: Workflow<{ userId: string; triggerCaptureId?: string }>;
}

// Re-export types for external use
export type { Signal, Commitment, Task } from "./db/daos";
export type { Entry } from "./db/daos/EntryDAO";

// ============================================================================
// Unified UserDO
// ============================================================================

export class UserDO extends DurableObject<Env> {
    private sql: SqlStorage;
    private state: DurableObjectState;
    
    // DAOs
    private entryDAO: EntryDAO;
    private signalDAO: SignalDAO;
    private commitmentDAO: CommitmentDAO;
    private taskDAO: TaskDAO;
    private feedDAO: FeedDAO;
    
    // Services
    private entryService: EntryService;
    private signalService: SignalService;
    private commitmentService: CommitmentService;
    private taskService: TaskService;
    private feedService: FeedService;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.state = state;
        this.sql = state.storage.sql;

        // Initialize DAOs
        this.entryDAO = new EntryDAO(this.sql);
        this.signalDAO = new SignalDAO(this.sql);
        this.commitmentDAO = new CommitmentDAO(this.sql);
        this.taskDAO = new TaskDAO(this.sql);
        this.feedDAO = new FeedDAO(this.sql);

        // Initialize Services
        this.entryService = new EntryService(this.entryDAO);
        this.signalService = new SignalService(this.signalDAO);
        this.commitmentService = new CommitmentService(this.commitmentDAO);
        this.taskService = new TaskService(this.taskDAO);
        this.feedService = new FeedService(this.feedDAO);

        this.initializeSchema();
    }

    private initializeSchema() {
        this.sql.exec(SCHEMA_QUERIES.ENTRIES_TABLE);
        this.sql.exec(SCHEMA_QUERIES.SIGNALS_TABLE);
        this.sql.exec(SCHEMA_QUERIES.COMMITMENTS_TABLE);
        this.sql.exec(SCHEMA_QUERIES.TASKS_TABLE);
        this.sql.exec(SCHEMA_QUERIES.FEED_SNAPSHOTS_TABLE);
        this.sql.exec(SCHEMA_QUERIES.PLANNER_STATE_TABLE);
        this.sql.exec(SCHEMA_QUERIES.EVENTS_TABLE);
    }

    // ========================================================================
    // Entries (Captures) Methods - Direct RPC (for tRPC)
    // ========================================================================

    async addEntry(
        userId: string,
        text: string,
        source: string,
        opts?: {
            id?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attachments?: any[];
            rootId?: string;
            parentId?: string;
            linkedTaskId?: string;
            linkedCommitmentId?: string;
            eventType?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload?: any;
        }
    ): Promise<string> {
        const entryId = this.entryService.addEntry(userId, text, source, opts);

        // Trigger workflow for background processing (non-blocking)
        if (this.env.SIGNALS_WORKFLOW) {
            this.state.waitUntil(
                this.env.SIGNALS_WORKFLOW.create({
                    id: `${userId}-${entryId}-${Date.now()}`,
                    params: {
                        userId,
                        triggerCaptureId: entryId,
                        windowDays: 30,
                    },
                }).then(() => {
                    if (this.env.FEED_WORKFLOW) {
                        return this.env.FEED_WORKFLOW.create({
                            id: `${userId}-feed-${Date.now()}`,
                            params: {
                                userId,
                                triggerCaptureId: entryId,
                            },
                        }).catch((err: unknown) => {
                            console.error("Failed to trigger feed workflow:", err);
                        });
                    }
                }).catch((err: unknown) => {
                    console.error("Failed to trigger signals workflow:", err);
                })
            );
        }

        return entryId;
    }

    async getCapturesForWindow(userId: string, windowDays: number): Promise<Array<{ id: string; text: string; created_at: number }>> {
        return this.entryService.getCapturesForWindow(userId, windowDays);
    }

    async getHome(userId: string) {
        return this.entryService.getHome(userId);
    }

    async getRecentEntries(limit: number = 20) {
        return this.entryService.getRecentEntries(limit);
    }

    // ========================================================================
    // Signals Methods - Direct RPC (for tRPC and Workflows)
    // ========================================================================

    async getSignals(
        userId: string,
        options: {
            entry_id?: string;
            trigger_capture_id?: string;
            include_history?: boolean;
            window_days?: number;
        }
    ): Promise<Signal[]> {
        return this.signalService.getSignals(userId, options);
    }

    async addSignalsBatch(
        userId: string,
        signals: Array<{
            entry_id: string;
            key: string;
            value: number;
            confidence: number;
        }>,
        model: string,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): Promise<string[]> {
        return this.signalService.addSignalsBatch(
                userId,
            signals,
                model,
                triggerCaptureId,
                sourceWindowDays,
                llmRunId
            );
    }

    // ========================================================================
    // Commitments Methods - Direct RPC (for tRPC and Workflows)
    // ========================================================================

    async getCommitments(
        userId: string,
        options: {
            status?: string;
            include_history?: boolean;
            trigger_capture_id?: string;
        }
    ): Promise<Commitment[]> {
        return this.commitmentService.getCommitments(userId, options);
    }

    async addCommitmentsBatch(
        userId: string,
        commitments: Array<{
            origin_entry_id: string;
            strength: string;
            horizon: string;
            content: string;
            status?: string;
        }>,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): Promise<string[]> {
        return this.commitmentService.addCommitmentsBatch(
                userId,
            commitments,
                triggerCaptureId,
                sourceWindowDays,
            llmRunId
        );
    }

    // ========================================================================
    // Tasks Methods - Direct RPC (for tRPC and Workflows)
    // ========================================================================

    async getTasks(
        userId: string,
        options: {
            status?: string;
            include_history?: boolean;
            trigger_capture_id?: string;
        }
    ): Promise<Task[]> {
        return this.taskService.getTasks(userId, options);
    }

    async addTasksBatch(
        userId: string,
        tasks: Array<{
            content: string;
            origin_entry_id?: string;
            priority?: string;
            due_date?: number;
            status?: string;
        }>,
        triggerCaptureId: string,
        sourceWindowDays: number,
        llmRunId: string
    ): Promise<string[]> {
        return this.taskService.addTasksBatch(
                userId,
            tasks,
                    triggerCaptureId,
                    sourceWindowDays,
                    llmRunId
        );
    }

    // ========================================================================
    // Feed Methods - Direct RPC (for tRPC and Workflows)
    // ========================================================================

    async getCurrentFeed(userId: string): Promise<FeedItemRendered[]> {
        return this.feedService.getCurrentFeed(userId);
    }

    async getFeedHistory(userId: string, limit: number = 10): Promise<Array<{
        feed_version: number;
        generated_at: number;
        item_count: number;
    }>> {
        return this.feedService.getFeedHistory(userId, limit);
    }

    async saveFeedSnapshot(
        userId: string,
        version: number,
        items: FeedItemRendered[]
    ): Promise<string> {
        return this.feedService.saveFeedSnapshot(userId, version, items);
    }

    async getNextFeedVersion(userId: string): Promise<number> {
        return this.feedService.getNextFeedVersion(userId);
    }

    // ========================================================================
    // HTTP Handler (fallback for legacy/external calls - workflows use RPC)
    // ========================================================================

    async fetch(_request: Request): Promise<Response> {
        // This method is kept for backward compatibility but workflows should use RPC
        void _request; // Parameter required by interface but unused
        return new Response(JSON.stringify({ error: 'Use direct RPC methods instead of fetch()' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

