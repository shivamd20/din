import { SIGNAL_QUERIES } from "../queries";

export interface Signal {
    id: string;
    user_id: string;
    entry_id: string;
    key: string;
    value: number;
    confidence: number;
    model: string;
    version: number;
    generated_at: number;
    expires_at: number | null;
    trigger_capture_id: string | null;
    source_window_days: number | null;
    llm_run_id: string | null;
}

export interface CreateSignalParams {
    id: string;
    userId: string;
    entryId: string;
    key: string;
    value: number;
    confidence: number;
    model: string;
    version: number;
    generatedAt: number;
    expiresAt: number | null;
    triggerCaptureId: string | null;
    sourceWindowDays: number | null;
    llmRunId: string | null;
}

export interface GetSignalsOptions {
    entry_id?: string;
    trigger_capture_id?: string;
    include_history?: boolean;
    window_days?: number;
}

/**
 * Data Access Object for Signals
 */
export class SignalDAO {
    constructor(private sql: SqlStorage) {}

    /**
     * Get the maximum version for a signal key
     */
    getMaxVersion(userId: string, entryId: string, key: string): number {
        const result = this.sql.exec(
            SIGNAL_QUERIES.GET_MAX_VERSION,
            userId,
            entryId,
            key
        ).one() as { max_version: number | null };
        return result.max_version || 0;
    }

    /**
     * Create a new signal
     */
    create(params: CreateSignalParams): void {
        this.sql.exec(
            SIGNAL_QUERIES.INSERT,
            params.id,
            params.userId,
            params.entryId,
            params.key,
            params.value,
            params.confidence,
            params.model,
            params.version,
            params.generatedAt,
            params.expiresAt,
            params.triggerCaptureId,
            params.sourceWindowDays,
            params.llmRunId
        );
    }

    /**
     * Get signals with optional filtering
     */
    get(userId: string, options: GetSignalsOptions = {}): Signal[] {
        let query = SIGNAL_QUERIES.GET_BASE;
        const params: (string | number)[] = [userId];

        // Build where conditions
        if (options.entry_id) {
            query += ` AND entry_id = ?`;
            params.push(options.entry_id);
        }

        if (options.trigger_capture_id) {
            query += ` AND trigger_capture_id = ?`;
            params.push(options.trigger_capture_id);
        }

        if (options.window_days) {
            const cutoffTime = Date.now() - (options.window_days * 24 * 60 * 60 * 1000);
            query += ` AND generated_at >= ?`;
            params.push(cutoffTime);
        }

        // If not including history, get only latest versions
        if (!options.include_history) {
            const subWhereConditions: string[] = ['user_id = ?'];
            const subParams: (string | number)[] = [userId];
            
            if (options.entry_id) {
                subWhereConditions.push('entry_id = ?');
                subParams.push(options.entry_id);
            }
            if (options.trigger_capture_id) {
                subWhereConditions.push('trigger_capture_id = ?');
                subParams.push(options.trigger_capture_id);
            }
            
            const cutoffTime = options.window_days 
                ? Date.now() - (options.window_days * 24 * 60 * 60 * 1000)
                : null;
            
            if (cutoffTime !== null) {
                subWhereConditions.push('generated_at >= ?');
                subParams.push(cutoffTime);
            }
            
            query = SIGNAL_QUERIES.GET_LATEST_VERSION(subWhereConditions);
            
            // Reset params: subParams (for subquery) + userId (for outer WHERE)
            params.length = 0;
            params.push(...subParams);
            params.push(userId);
        }

        query += ` ORDER BY generated_at DESC`;

        return this.sql.exec(query, ...params).toArray() as unknown as Signal[];
    }
}

