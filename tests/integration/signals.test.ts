import { describe, it, expect, beforeAll } from 'vitest';
import { createTestTRPCClient, TEST_USER } from '../utils/trpc-client';
import { delay } from '../setup';

describe('Signals Integration Tests', () => {
    const client = createTestTRPCClient();
    const userId = TEST_USER.id;
    let testEntryId: string;

    beforeAll(async () => {
        // Create a test entry first
        const entry = await client.entries.mutate({
            text: 'Test entry for signals generation',
            source: 'test'
        });
        testEntryId = entry.entry_id;
        
        // Wait a bit for processing
        await delay(3000);
    });

    it('should create an entry', async () => {
        const entry = await client.entries.mutate({
            text: 'This is a test entry',
            source: 'test'
        });

        expect(entry.entry_id).toBeDefined();
        expect(typeof entry.entry_id).toBe('string');
    });

    it('should list signals', async () => {
        const signals = await client.signals.list.query({
            include_history: false
        });

        expect(Array.isArray(signals)).toBe(true);
        // Signals might be empty if workflow hasn't run yet
    }, 30000); // 30 second timeout

    it('should list signals with filters', async () => {
        const signals = await client.signals.list.query({
            entry_id: testEntryId,
            include_history: false
        });

        expect(Array.isArray(signals)).toBe(true);
    });

    it('should list commitments', async () => {
        const commitments = await client.commitments.list.query({
            include_history: false
        });

        expect(Array.isArray(commitments)).toBe(true);
    });

    it('should list commitments with status filter', async () => {
        const commitments = await client.commitments.list.query({
            status: 'active',
            include_history: false
        });

        expect(Array.isArray(commitments)).toBe(true);
    });

    it('should list tasks', async () => {
        const tasks = await client.tasks.list.query({
            include_history: false
        });

        expect(Array.isArray(tasks)).toBe(true);
    });

    it('should list tasks with status filter', async () => {
        const tasks = await client.tasks.list.query({
            status: 'pending',
            include_history: false
        });

        expect(Array.isArray(tasks)).toBe(true);
    });

    it('should trigger signals generation', async () => {
        const result = await client.signalsGenerate.mutate({
            window_days: 30
        });

        expect(result.success).toBe(true);
        
        // Wait for workflow to complete
        await delay(5000);
        
        // Check that signals were generated
        const signals = await client.signals.list.query({
            include_history: false
        });
        
        // Signals might be empty if no captures exist, but should not error
        expect(Array.isArray(signals)).toBe(true);
    });

    it('should include history when requested', async () => {
        const signals = await client.signals.list.query({
            include_history: true
        });

        expect(Array.isArray(signals)).toBe(true);
    });
});

