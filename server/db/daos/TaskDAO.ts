import { TASK_QUERIES } from "../queries";

export interface Task {
    id: string;
    user_id: string;
    content: string;
    commitment_id: string | null;
    origin_entry_id: string;
    planned_date: number | null;
    duration_minutes: number;
    preferred_window: string | null; // morning | afternoon | evening | anytime
    task_type: string; // planned | reactive | clarification
    status: string; // planned | started | paused | completed | abandoned
    created_at: number;
    last_event_capture_id: string | null;
    time_spent_minutes: number;
    confidence_score: number;
    snoozed_until: number | null;
    source_type: string; // ai | user
    version: number;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    llm_run_id: string | null;
}

export interface CreateTaskParams {
    id: string;
    userId: string;
    content: string;
    commitmentId: string | null;
    originEntryId: string;
    plannedDate: number | null;
    durationMinutes: number;
    preferredWindow: string | null;
    taskType: string;
    status: string;
    createdAt: number;
    lastEventCaptureId: string | null;
    timeSpentMinutes: number;
    confidenceScore: number;
    snoozedUntil: number | null;
    sourceType: string;
    version: number;
    triggerCaptureId: string | null;
    sourceWindowDays: number | null;
    llmRunId: string | null;
}

export interface GetTasksOptions {
    status?: string;
    include_history?: boolean;
    trigger_capture_id?: string;
}

/**
 * Data Access Object for Tasks
 */
export class TaskDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Get the maximum version for a task
     */
    getMaxVersion(userId: string, content: string): number {
        const result = this.sql.exec(
            TASK_QUERIES.GET_MAX_VERSION,
            userId,
            content
        ).one() as { max_version: number | null };
        return result.max_version || 0;
    }

    /**
     * Create a new task
     */
    create(params: CreateTaskParams): void {
        this.sql.exec(
            TASK_QUERIES.INSERT,
            params.id,
            params.userId,
            params.content,
            params.commitmentId,
            params.originEntryId,
            params.plannedDate,
            params.durationMinutes,
            params.preferredWindow,
            params.taskType,
            params.status,
            params.createdAt,
            params.lastEventCaptureId,
            params.timeSpentMinutes,
            params.confidenceScore,
            params.snoozedUntil,
            params.sourceType,
            params.version,
            params.triggerCaptureId,
            params.sourceWindowDays,
            params.llmRunId
        );
    }

    /**
     * Get tasks with optional filtering
     */
    get(userId: string, options: GetTasksOptions = {}): Task[] {
        let query = TASK_QUERIES.GET_BASE;
        const params: (string | number)[] = [userId];

        if (options.status) {
            query += ` AND status = ?`;
            params.push(options.status);
        }

        if (options.trigger_capture_id) {
            query += ` AND trigger_capture_id = ?`;
            params.push(options.trigger_capture_id);
        }

        if (!options.include_history) {
            const subWhereConditions: string[] = ['user_id = ?'];
            const subParams: (string | number)[] = [userId];
            
            if (options.status) {
                subWhereConditions.push('status = ?');
                subParams.push(options.status);
            }
            if (options.trigger_capture_id) {
                subWhereConditions.push('trigger_capture_id = ?');
                subParams.push(options.trigger_capture_id);
            }
            
            query = TASK_QUERIES.GET_LATEST_VERSION(subWhereConditions);
            
            // Reset params: subParams (for subquery) + userId (for outer WHERE)
            params.length = 0;
            params.push(...subParams);
            params.push(userId);
        }

        query += ` ORDER BY created_at DESC`;

        return this.sql.exec(query, ...params).toArray() as unknown as Task[];
    }
}

