import { v4 as uuidv4 } from 'uuid';
import { SignalDAO, type CreateSignalParams, type GetSignalsOptions } from '../db/daos/SignalDAO';
import type { Signal } from '../db/daos/SignalDAO';

/**
 * Service layer for Signal business logic
 */
export class SignalService {
    constructor(private signalDAO: SignalDAO) {}

    /**
     * Add a single signal
     */
    addSignal(
        userId: string,
        entryId: string,
        key: string,
        value: number,
        confidence: number,
        model: string,
        triggerCaptureId: string | null,
        sourceWindowDays: number | null,
        llmRunId: string | null
    ): string {
        const maxVersion = this.signalDAO.getMaxVersion(userId, entryId, key);
        const newVersion = maxVersion + 1;

        const id = uuidv4();
        const now = Date.now();

        const params: CreateSignalParams = {
            id,
            userId,
            entryId,
            key,
            value,
            confidence,
            model,
            version: newVersion,
            generatedAt: now,
            expiresAt: null,
            triggerCaptureId,
            sourceWindowDays,
            llmRunId,
        };

        this.signalDAO.create(params);
        return id;
    }

    /**
     * Add multiple signals in batch
     */
    addSignalsBatch(
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
    ): string[] {
        const ids: string[] = [];
        for (const signal of signals) {
            const id = this.addSignal(
                userId,
                signal.entry_id,
                signal.key,
                signal.value,
                signal.confidence,
                model,
                triggerCaptureId,
                sourceWindowDays,
                llmRunId
            );
            ids.push(id);
        }
        return ids;
    }

    /**
     * Get signals with options
     */
    getSignals(userId: string, options: GetSignalsOptions = {}): Signal[] {
        return this.signalDAO.get(userId, options);
    }
}


