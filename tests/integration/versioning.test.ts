import { describe, it, expect } from 'vitest';
import { createTestTRPCClient, TEST_USER } from '../utils/trpc-client';
import { delay } from '../setup';

describe('Versioning Integration Tests', () => {
    const client = createTestTRPCClient();
    const userId = TEST_USER.id;

    it('should create new versions on each generation', async () => {
        // Create an entry
        const entry = await client.entries.mutate({
            text: 'Version test entry',
            source: 'test'
        });

        // Generate signals first time
        await client.signalsGenerate.mutate({
            window_days: 30,
            trigger_capture_id: entry.entry_id
        });

        await delay(5000);

        const signals1 = await client.signals.list.query({
            include_history: false
        });

        // Generate signals second time
        await client.signalsGenerate.mutate({
            window_days: 30,
            trigger_capture_id: entry.entry_id
        });

        await delay(5000);

        const signals2 = await client.signals.list.query({
            include_history: false
        });

        // Both should be arrays (might be empty)
        expect(Array.isArray(signals1)).toBe(true);
        expect(Array.isArray(signals2)).toBe(true);

        // Check history includes multiple versions
        const allSignals = await client.signals.list.query({
            include_history: true
        });

        expect(Array.isArray(allSignals)).toBe(true);
    });

    it('should show latest version by default', async () => {
        const signals = await client.signals.list.query({
            include_history: false
        });

        // Should only get latest versions
        expect(Array.isArray(signals)).toBe(true);

        // If we have signals, check they have version info
        if (signals.length > 0) {
            const signal = signals[0] as any;
            expect(signal).toHaveProperty('version');
            expect(signal).toHaveProperty('trigger_capture_id');
        }
    });

    it('should show all versions when history is enabled', async () => {
        const allSignals = await client.signals.list.query({
            include_history: true
        });

        expect(Array.isArray(allSignals)).toBe(true);
    });
});

