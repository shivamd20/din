import { v4 as uuidv4 } from 'uuid';
import { TaskDAO, type CreateTaskParams, type GetTasksOptions } from '../db/daos/TaskDAO';
import type { Task } from '../db/daos/TaskDAO';

export interface AddTaskOptions {
    commitmentId?: string | null;
    plannedDate?: number | null;
    durationMinutes?: number;
    preferredWindow?: string | null;
    taskType?: string;
    status?: string;
    sourceType?: string;
    triggerCaptureId?: string | null;
    sourceWindowDays?: number | null;
    llmRunId?: string | null;
}

/**
 * Service layer for Task business logic
 */
export class TaskService {
    constructor(private taskDAO: TaskDAO) {}

    /**
     * Add a single task
     */
    addTask(
        userId: string,
        content: string,
        originEntryId: string,
        opts?: AddTaskOptions
    ): string {
        const maxVersion = this.taskDAO.getMaxVersion(userId, content);
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        const params: CreateTaskParams = {
            id,
            userId,
            content,
            commitmentId: opts?.commitmentId || null,
            originEntryId,
            plannedDate: opts?.plannedDate || null,
            durationMinutes: opts?.durationMinutes || 30,
            preferredWindow: opts?.preferredWindow || null,
            taskType: opts?.taskType || 'planned',
            status: opts?.status || 'planned',
            createdAt: now,
            lastEventCaptureId: null,
            timeSpentMinutes: 0,
            confidenceScore: 0.5,
            snoozedUntil: null,
            sourceType: opts?.sourceType || 'ai',
            version: newVersion,
            triggerCaptureId: opts?.triggerCaptureId || null,
            sourceWindowDays: opts?.sourceWindowDays || null,
            llmRunId: opts?.llmRunId || null,
        };

        this.taskDAO.create(params);
        return id;
    }

    /**
     * Add multiple tasks in batch
     */
    addTasksBatch(
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
    ): string[] {
        const ids: string[] = [];
        // Use triggerCaptureId as origin_entry_id if not provided
        const defaultOriginEntryId = triggerCaptureId;
        for (const task of tasks) {
            const id = this.addTask(
                userId,
                task.content,
                task.origin_entry_id || defaultOriginEntryId,
                {
                    plannedDate: task.due_date || null,
                    status: task.status || 'planned',
                    triggerCaptureId,
                    sourceWindowDays,
                    llmRunId
                }
            );
            ids.push(id);
        }
        return ids;
    }

    /**
     * Get tasks with options
     */
    getTasks(userId: string, options: GetTasksOptions = {}): Task[] {
        return this.taskDAO.get(userId, options);
    }
}

