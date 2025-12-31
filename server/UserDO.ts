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
    // Rich metadata fields
    generation_reason?: string;
    related_task_id?: string | null;
    related_commitment_id?: string | null;
    related_signal_ids?: string[];
    source_entry_ids?: string[];
    priority_score?: number;
    expires_at?: number | null;
    metadata?: {
        context?: {
            time_of_day?: string;
            energy_level?: number;
            location?: string;
        };
        timing?: string;
        urgency?: number;
        importance?: number;
        deadline?: number;
        duration_estimate?: number;
    };
    created_at?: number;
    type?: string;
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
    private aiServicePromise: Promise<import('./ai-service').AIService> | null = null;

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
        // Initialize AIService lazily (will be created when needed)
        this.aiServicePromise = import('./ai-service').then(({ AIService }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new AIService(this.env as any);
        });
        this.commitmentService = new CommitmentService(this.commitmentDAO, undefined);
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
        
        // Run migrations to add new columns to existing tables
        this.runMigrations();
    }

    private runMigrations() {
        // Migration: Add optional context columns to entries table
        // SQLite will throw an error if column already exists, so we catch and ignore
        const migrations = [
            { table: 'entries', column: 'location', type: 'TEXT' },
            { table: 'entries', column: 'mood', type: 'TEXT' },
            { table: 'entries', column: 'energy_level', type: 'INTEGER' },
            { table: 'entries', column: 'feed_item_id', type: 'TEXT' },
            { table: 'entries', column: 'action_type', type: 'TEXT' },
            { table: 'entries', column: 'action_context', type: 'TEXT' },
            { table: 'feed_snapshots', column: 'last_processed_entry_id', type: 'TEXT' },
            { table: 'feed_snapshots', column: 'cache_metrics_json', type: 'TEXT' },
            // Commitment schema migrations
            { table: 'commitments', column: 'confirmed_at', type: 'INTEGER' },
            { table: 'commitments', column: 'time_horizon_type', type: 'TEXT' },
            { table: 'commitments', column: 'time_horizon_value', type: 'INTEGER' },
            { table: 'commitments', column: 'cadence_days', type: 'INTEGER' },
            { table: 'commitments', column: 'check_in_method', type: 'TEXT' },
        ];

        for (const migration of migrations) {
            try {
                this.sql.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}`);
            } catch (e: unknown) {
                // Column already exists or table doesn't exist yet - both are fine
                // SQLite error code 1 means the column already exists
                const errorMessage = e instanceof Error ? e.message : String(e);
                if (errorMessage && !errorMessage.includes('duplicate column name') && !errorMessage.includes('no such column')) {
                    console.warn(`[Migration] Failed to add ${migration.column} to ${migration.table}:`, errorMessage);
                }
                // Silently ignore "duplicate column" errors
            }
        }
        
        // Migrate existing commitment statuses
        try {
            this.sql.exec(`UPDATE commitments SET status = 'active' WHERE status = 'acknowledged'`);
            this.sql.exec(`UPDATE commitments SET status = 'retired' WHERE status = 'cancelled'`);
            
            // Set confirmed_at to created_at for existing commitments (treat as already confirmed)
            this.sql.exec(`UPDATE commitments SET confirmed_at = created_at WHERE confirmed_at IS NULL`);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.warn(`[Migration] Failed to migrate commitment statuses:`, errorMessage);
        }
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
            feedItemId?: string | null;
            actionType?: string | null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actionContext?: any;
        }
    ): Promise<string> {
        const entryId = this.entryService.addEntry(userId, text, source, opts);

        // Handle event-driven state transitions
        if (opts?.eventType && opts?.linkedTaskId) {
            const taskId = opts.linkedTaskId;
            switch (opts.eventType) {
                case 'task_start':
                    this.taskService.updateTaskStatus(userId, taskId, 'started', entryId);
                    break;
                case 'task_snooze': {
                    const snoozedUntil = opts.payload?.snoozedUntil ? new Date(opts.payload.snoozedUntil).getTime() : Date.now() + 24 * 60 * 60 * 1000; // Default: 24 hours
                    this.taskService.updateTaskStatus(userId, taskId, 'planned', entryId, { snoozedUntil });
                    break;
                }
                case 'task_skip':
                    this.taskService.updateTaskStatus(userId, taskId, 'abandoned', entryId);
                    break;
                case 'task_finish':
                    this.taskService.updateTaskStatus(userId, taskId, 'completed', entryId);
                    break;
            }
        }

        if (opts?.eventType && opts?.linkedCommitmentId) {
            const commitmentId = opts.linkedCommitmentId;
            switch (opts.eventType) {
                case 'commitment_acknowledge':
                    this.commitmentService.updateCommitmentStatus(userId, commitmentId, 'active', entryId, true);
                    break;
                case 'commitment_complete':
                    this.commitmentService.updateCommitmentStatus(userId, commitmentId, 'completed', entryId, true);
                    break;
                case 'commitment_cancel':
                    this.commitmentService.updateCommitmentStatus(userId, commitmentId, 'retired', entryId);
                    break;
            }
        }

        // Handle renegotiation (when user describes changes to a commitment without explicit event type)
        if (opts?.linkedCommitmentId && !opts?.eventType && text && text.toLowerCase().includes('renegotiat')) {
            // Parse renegotiation text to extract changes
            const linkedCommitmentId = opts.linkedCommitmentId;
            this.state.waitUntil(
                (async () => {
                    try {
                        // Get AIService if not already set
                        if (this.aiServicePromise) {
                            const aiService = await this.aiServicePromise;
                            const { CommitmentService } = await import('./services');
                            this.commitmentService = new CommitmentService(this.commitmentDAO, aiService);
                        }
                        
                        const currentCommitment = this.commitmentService.getCommitmentById(userId, linkedCommitmentId);
                        if (!currentCommitment) {
                            console.error(`[UserDO] Commitment ${opts.linkedCommitmentId} not found for renegotiation`);
                            return;
                        }

                        // Parse changes from text using LLM
                        if (this.aiServicePromise && text) {
                            const aiService = await this.aiServicePromise;
                            const parsed = await aiService.parseCommitmentDetails(text);
                            
                            // Create new version with updated fields
                            const maxVersion = this.commitmentDAO.getMaxVersion(userId, currentCommitment.origin_entry_id);
                            const newVersion = maxVersion + 1;
                            const now = Date.now();
                            
                            // Update content if changed, otherwise keep original
                            const updatedContent = parsed.content !== text ? parsed.content : currentCommitment.content;
                            
                            // Update expires_at if time_horizon_value changed
                            const updatedExpiresAt = parsed.time_horizon_type === "date" && parsed.time_horizon_value
                                ? parsed.time_horizon_value
                                : currentCommitment.expires_at;

                            const params: import('./db/daos/CommitmentDAO').CreateCommitmentParams = {
                                id: crypto.randomUUID(),
                                userId,
                                originEntryId: currentCommitment.origin_entry_id,
                                content: updatedContent,
                                strength: parsed.strength || currentCommitment.strength,
                                horizon: parsed.horizon || currentCommitment.horizon,
                                status: 'renegotiated', // Mark as renegotiated
                                createdAt: now,
                                expiresAt: updatedExpiresAt,
                                lastAcknowledgedAt: currentCommitment.last_acknowledged_at,
                                progressScore: currentCommitment.progress_score,
                                sourceType: currentCommitment.source_type,
                                version: newVersion,
                                triggerCaptureId: currentCommitment.trigger_capture_id,
                                sourceWindowDays: currentCommitment.source_window_days,
                                llmRunId: currentCommitment.llm_run_id,
                                confirmedAt: currentCommitment.confirmed_at,
                                timeHorizonType: parsed.time_horizon_type || currentCommitment.time_horizon_type,
                                timeHorizonValue: parsed.time_horizon_value || currentCommitment.time_horizon_value,
                                cadenceDays: parsed.cadence_days || currentCommitment.cadence_days,
                                checkInMethod: parsed.check_in_method || currentCommitment.check_in_method,
                            };

                            this.commitmentDAO.create(params);
                            console.log(`[UserDO] Renegotiated commitment ${opts.linkedCommitmentId} for user ${userId}`);
                        }
                    } catch (err: unknown) {
                        console.error(`[UserDO] Failed to renegotiate commitment:`, err);
                    }
                })()
            );
        }

        // Handle commitment_confirm event (creates new commitment from potential)
        if (opts?.eventType === 'commitment_confirm') {
            // Extract feed item metadata from action_context if available
            const feedItemMetadata = opts.actionContext as Record<string, unknown> | undefined;
            const originEntryId = opts.feedItemId || entryId; // Use feed_item_id as origin if available
            
            // Confirm commitment asynchronously
            this.state.waitUntil(
                (async () => {
                    try {
                        // Get AIService if not already set
                        if (this.aiServicePromise) {
                            const aiService = await this.aiServicePromise;
                            // Create new CommitmentService with AIService
                            const { CommitmentService } = await import('./services');
                            this.commitmentService = new CommitmentService(this.commitmentDAO, aiService);
                        }
                        await this.commitmentService.confirmCommitment(
                            userId,
                            originEntryId,
                            text,
                            feedItemMetadata
                        );
                        console.log(`[UserDO] Confirmed commitment for user ${userId} from entry ${entryId}`);
                    } catch (err: unknown) {
                        console.error(`[UserDO] Failed to confirm commitment:`, err);
                    }
                })()
            );
        }

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
                }).catch((err: unknown) => {
                    console.error("Failed to trigger signals workflow:", err);
                })
            );
        }

        // Schedule feed regeneration via alarm (batch processing)
        // Instead of immediate regeneration, mark feed as needing update and schedule alarm
        this.scheduleFeedBatchProcessing(userId);

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

    async getAllEntries(userId: string) {
        return this.entryService.getAllEntries(userId);
    }

    async getLastProcessedEntryId(userId: string): Promise<string | null> {
        return this.feedService.getLastProcessedEntryId(userId);
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
        // Track feed view activity
        await this.trackUserActivity(userId, 'feed_view');
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
        items: FeedItemRendered[],
        metadata?: {
            lastProcessedEntryId?: string | null;
            cacheMetrics?: Record<string, unknown>;
        }
    ): Promise<string> {
        return this.feedService.saveFeedSnapshot(userId, version, items, metadata);
    }

    async getNextFeedVersion(userId: string): Promise<number> {
        return this.feedService.getNextFeedVersion(userId);
    }

    // ========================================================================
    // Activity Tracking System
    // ========================================================================

    /**
     * Track user activity (called when user adds capture or views feed)
     */
    private async trackUserActivity(userId: string, activityType: 'capture' | 'feed_view' = 'capture'): Promise<void> {
        const now = Date.now();
        
        // Update last activity timestamp
        await this.state.storage.put(`activity-last-${activityType}-${userId}`, now);
        await this.state.storage.put(`activity-last-activity-${userId}`, now);
        
        // Update capture count for capture activities
        if (activityType === 'capture') {
            const captureCounts = await this.state.storage.get<{
                last24h: number;
                last7d: number;
                last30d: number;
                timestamps: number[];
            }>(`activity-capture-count-${userId}`) || {
                last24h: 0,
                last7d: 0,
                last30d: 0,
                timestamps: []
            };
            
            // Add current timestamp and filter old ones
            captureCounts.timestamps.push(now);
            const day24h = 24 * 60 * 60 * 1000;
            const day7d = 7 * day24h;
            const day30d = 30 * day24h;
            
            captureCounts.timestamps = captureCounts.timestamps.filter(ts => now - ts <= day30d);
            captureCounts.last24h = captureCounts.timestamps.filter(ts => now - ts <= day24h).length;
            captureCounts.last7d = captureCounts.timestamps.filter(ts => now - ts <= day7d).length;
            captureCounts.last30d = captureCounts.timestamps.length;
            
            await this.state.storage.put(`activity-capture-count-${userId}`, captureCounts);
        }
        
        // Invalidate cached activity score
        await this.state.storage.delete(`activity-score-${userId}`);
    }

    /**
     * Calculate user activity score (0.0 to 1.0)
     * Higher score = more active user
     */
    private async calculateActivityScore(userId: string): Promise<number> {
        // Check cache first (recalculate every hour)
        const cached = await this.state.storage.get<{ score: number; timestamp: number }>(`activity-score-${userId}`);
        const now = Date.now();
        if (cached && (now - cached.timestamp) < 60 * 60 * 1000) {
            return cached.score;
        }
        
        const day24h = 24 * 60 * 60 * 1000;
        const day7d = 7 * day24h;
        
        // Get last activity time
        const lastActivity = await this.state.storage.get<number>(`activity-last-activity-${userId}`) || 0;
        const timeSinceActivity = now - lastActivity;
        
        // Get capture counts
        const captureCounts = await this.state.storage.get<{
            last24h: number;
            last7d: number;
            last30d: number;
            timestamps: number[];
        }>(`activity-capture-count-${userId}`) || {
            last24h: 0,
            last7d: 0,
            last30d: 0,
            timestamps: []
        };
        
        // Calculate score components (weighted)
        let score = 0.0;
        
        // Component 1: Recent activity (last 24h) - 40% weight
        // Normalize: 10+ captures in 24h = 1.0, 0 = 0.0
        const recentActivityScore = Math.min(captureCounts.last24h / 10, 1.0);
        score += recentActivityScore * 0.4;
        
        // Component 2: Medium-term activity (last 7d) - 30% weight
        // Normalize: 30+ captures in 7d = 1.0, 0 = 0.0
        const mediumActivityScore = Math.min(captureCounts.last7d / 30, 1.0);
        score += mediumActivityScore * 0.3;
        
        // Component 3: Long-term activity (last 30d) - 20% weight
        // Normalize: 100+ captures in 30d = 1.0, 0 = 0.0
        const longActivityScore = Math.min(captureCounts.last30d / 100, 1.0);
        score += longActivityScore * 0.2;
        
        // Component 4: Time since last activity - 10% weight
        // Recent activity (within 1h) = 1.0, decays to 0 over 7 days
        let recencyScore = 0.0;
        if (timeSinceActivity < 60 * 60 * 1000) {
            recencyScore = 1.0;
        } else if (timeSinceActivity < day7d) {
            recencyScore = 1.0 - (timeSinceActivity / day7d);
        }
        score += recencyScore * 0.1;
        
        // Clamp score between 0 and 1
        score = Math.max(0.0, Math.min(1.0, score));
        
        // Cache the score
        await this.state.storage.put(`activity-score-${userId}`, { score, timestamp: now });
        
        return score;
    }

    // ========================================================================
    // Feed Batch Processing with Alarms
    // ========================================================================

    /**
     * Calculate adaptive refresh interval based on activity score
     * Returns interval in milliseconds
     */
    private calculateRefreshInterval(activityScore: number): number {
        const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
        const MAX_REFRESH_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 hours
        
        let interval: number;
        
        if (activityScore > 0.8) {
            // Very Active: 5-15 minutes
            interval = MIN_REFRESH_INTERVAL_MS + (activityScore - 0.8) * 5 * 10 * 60 * 1000; // 5-15 min
        } else if (activityScore > 0.5) {
            // Active: 30-60 minutes
            interval = 30 * 60 * 1000 + (activityScore - 0.5) / 0.3 * 30 * 60 * 1000; // 30-60 min
        } else if (activityScore > 0.2) {
            // Moderate: 2-6 hours
            interval = 2 * 60 * 60 * 1000 + (activityScore - 0.2) / 0.3 * 4 * 60 * 60 * 1000; // 2-6 hours
        } else if (activityScore > 0.1) {
            // Low: 12-24 hours
            interval = 12 * 60 * 60 * 1000 + (activityScore - 0.1) / 0.1 * 12 * 60 * 60 * 1000; // 12-24 hours
        } else {
            // Inactive: 24-48 hours (minimal refresh)
            interval = 24 * 60 * 60 * 1000 + (activityScore / 0.1) * 24 * 60 * 60 * 1000; // 24-48 hours
        }
        
        // Apply exponential backoff for very low scores
        if (activityScore < 0.05) {
            const inactivityMultiplier = Math.floor((0.05 - activityScore) / 0.01);
            interval = interval * Math.pow(2, Math.min(inactivityMultiplier, 3)); // Max 8x multiplier
        }
        
        // Clamp to min/max bounds
        return Math.max(MIN_REFRESH_INTERVAL_MS, Math.min(MAX_REFRESH_INTERVAL_MS, interval));
    }

    /**
     * Check if feed should be refreshed based on staleness and activity
     */
    private async shouldRefreshFeed(userId: string, activityScore: number): Promise<boolean> {
        // Get last feed generation time
        const feedHistory = this.feedService.getFeedHistory(userId, 1);
        if (feedHistory.length === 0) {
            // No feed exists, should refresh
            return true;
        }
        
        const lastFeedTime = feedHistory[0].generated_at;
        const now = Date.now();
        const timeSinceFeed = now - lastFeedTime;
        
        // Calculate staleness threshold based on activity score
        const baseInterval = this.calculateRefreshInterval(activityScore);
        const STALENESS_THRESHOLD_MULTIPLIER = 1.5;
        const stalenessThreshold = baseInterval * STALENESS_THRESHOLD_MULTIPLIER;
        
        // For inactive users, only refresh if feed is very stale (>24h)
        if (activityScore < 0.1) {
            const INACTIVE_STALENESS_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
            return timeSinceFeed > INACTIVE_STALENESS_THRESHOLD;
        }
        
        // For active users, refresh if feed exceeds staleness threshold
        return timeSinceFeed > stalenessThreshold;
    }

    /**
     * Schedule feed batch processing via alarm with adaptive intervals
     * Uses activity-based intelligent scheduling
     */
    private async scheduleFeedBatchProcessing(userId: string): Promise<void> {
        // Track activity
        await this.trackUserActivity(userId, 'capture');
        
        // Calculate activity score
        const activityScore = await this.calculateActivityScore(userId);
        
        // Calculate adaptive refresh interval
        const refreshInterval = this.calculateRefreshInterval(activityScore);
        
        // Mark that feed needs regeneration
        await this.state.storage.put(`feed-needs-regeneration-${userId}`, true);
        
        // Get current alarm time if one exists
        const currentAlarm = await this.state.storage.getAlarm();
        
        // Calculate new alarm time
        const newAlarmTime = Date.now() + refreshInterval;
        
        // Only reschedule if no alarm exists or if the new alarm is sooner
        if (!currentAlarm || newAlarmTime < currentAlarm) {
            await this.state.storage.setAlarm(newAlarmTime);
            const intervalMinutes = Math.round(refreshInterval / (60 * 1000));
            console.log(`[FeedBatch] Scheduled feed regeneration for user ${userId} (score: ${activityScore.toFixed(2)}) at ${new Date(newAlarmTime).toISOString()} (${intervalMinutes} min interval)`);
        }
    }

    /**
     * Durable Object alarm handler - processes feed regeneration in batches with smart conditions
     */
    async alarm(): Promise<void> {
        // Get the user ID from the durable object ID name
        // Since we use idFromName(userId), the name property contains the userId
        const userId = this.state.id.name;
        
        if (!userId) {
            console.error('[FeedBatch] Cannot determine userId from DO ID');
            return;
        }
        
        // Recalculate activity score before processing
        const activityScore = await this.calculateActivityScore(userId);
        
        // Check if feed needs regeneration
        const needsRegeneration = await this.state.storage.get<boolean>(`feed-needs-regeneration-${userId}`);
        
        if (!needsRegeneration) {
            console.log(`[FeedBatch] No regeneration flag set for user ${userId}`);
            return;
        }
        
        // Smart condition checks
        const shouldRefresh = await this.shouldRefreshFeed(userId, activityScore);
        
        if (!shouldRefresh) {
            console.log(`[FeedBatch] Skipping refresh for user ${userId} - feed is still fresh (score: ${activityScore.toFixed(2)})`);
            // Clear the flag since we've decided not to refresh
            await this.state.storage.delete(`feed-needs-regeneration-${userId}`);
            // Reschedule for later
            const refreshInterval = this.calculateRefreshInterval(activityScore);
            await this.state.storage.setAlarm(Date.now() + refreshInterval);
            return;
        }
        
        // Check if user has been inactive for too long (inactive threshold)
        const INACTIVE_THRESHOLD_DAYS = 7;
        const lastActivity = await this.state.storage.get<number>(`activity-last-activity-${userId}`) || 0;
        const daysSinceActivity = (Date.now() - lastActivity) / (24 * 60 * 60 * 1000);
        
        if (daysSinceActivity > INACTIVE_THRESHOLD_DAYS && activityScore < 0.05) {
            console.log(`[FeedBatch] User ${userId} is inactive (${daysSinceActivity.toFixed(1)} days), deferring refresh`);
            // Clear flag and reschedule for much later
            await this.state.storage.delete(`feed-needs-regeneration-${userId}`);
            const deferredInterval = 48 * 60 * 60 * 1000; // 48 hours
            await this.state.storage.setAlarm(Date.now() + deferredInterval);
            return;
        }
        
        // All checks passed, proceed with refresh
        if (this.env.FEED_WORKFLOW) {
            console.log(`[FeedBatch] Processing feed regeneration for user ${userId} (score: ${activityScore.toFixed(2)})`);
            
            // Clear the regeneration flag
            await this.state.storage.delete(`feed-needs-regeneration-${userId}`);
            
            // Trigger feed workflow
            try {
                await this.env.FEED_WORKFLOW.create({
                    id: `${userId}-feed-batch-${Date.now()}`,
                    params: {
                        userId,
                    },
                });
                console.log(`[FeedBatch] Successfully triggered feed workflow for user ${userId}`);
                
                // Update activity metrics after refresh
                await this.trackUserActivity(userId, 'feed_view');
            } catch (err: unknown) {
                console.error(`[FeedBatch] Failed to trigger feed workflow for user ${userId}:`, err);
                // Re-mark as needing regeneration so we can retry later
                await this.state.storage.put(`feed-needs-regeneration-${userId}`, true);
            }
        } else {
            console.log(`[FeedBatch] Feed workflow not available for user ${userId}`);
        }
    }

    /**
     * Manually trigger feed regeneration (for refresh button)
     */
    async triggerFeedRegeneration(userId: string): Promise<void> {
        // Track activity for manual refresh (shows user engagement)
        await this.trackUserActivity(userId, 'feed_view');
        
        if (this.env.FEED_WORKFLOW) {
            await this.env.FEED_WORKFLOW.create({
                id: `${userId}-feed-manual-${Date.now()}`,
                params: {
                    userId,
                },
            });
            // Clear the regeneration flag since we're processing it now
            await this.state.storage.delete(`feed-needs-regeneration-${userId}`);
        } else {
            throw new Error('Feed workflow not available');
        }
    }

    // ========================================================================
    // Undo Support - Revert State Changes
    // ========================================================================

    async revertStateChange(userId: string, captureId: string): Promise<void> {
        // Get the entry to find what it changed
        const entry = this.entryDAO.getById(captureId);
        if (!entry) {
            throw new Error(`Entry ${captureId} not found`);
        }

        // If this capture changed a task, revert the task status
        if (entry.linked_task_id && entry.event_type) {
            const task = this.taskService.getTaskById(userId, entry.linked_task_id);
            if (task) {
                // Find the previous version of this task
                const allTasks = this.taskDAO.get(userId, { include_history: true });
                const taskVersions = allTasks.filter(t => t.content === task.content).sort((a, b) => b.version - a.version);
                if (taskVersions.length > 1) {
                    // Get the version before the current one
                    const previousVersion = taskVersions[1];
                    // Create a new version with the previous status
                    this.taskService.updateTaskStatus(userId, entry.linked_task_id, previousVersion.status, captureId);
                }
            }
        }

        // If this capture changed a commitment, revert the commitment status
        if (entry.linked_commitment_id && entry.event_type) {
            const commitment = this.commitmentService.getCommitmentById(userId, entry.linked_commitment_id);
            if (commitment) {
                // Find the previous version of this commitment
                const allCommitments = this.commitmentDAO.get(userId, { include_history: true });
                const commitmentVersions = allCommitments.filter(c => c.origin_entry_id === commitment.origin_entry_id).sort((a, b) => b.version - a.version);
                if (commitmentVersions.length > 1) {
                    // Get the version before the current one
                    const previousVersion = commitmentVersions[1];
                    // Create a new version with the previous status
                    this.commitmentService.updateCommitmentStatus(userId, entry.linked_commitment_id, previousVersion.status, captureId);
                }
            }
        }

        // Note: We don't delete the capture entry - it remains in history
        // The state change is reverted by creating a new version with previous status
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

