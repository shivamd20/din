import { describe, it, expect } from 'vitest';
import { createTestTRPCClient, TEST_USER } from '../utils/trpc-client';
import { delay } from '../setup';

describe('Workflow Integration Tests', () => {
    const client = createTestTRPCClient();
    const userId = TEST_USER.id;

    it('should create multiple entries and trigger workflow', async () => {
        // Create several entries
        const entry1 = await client.entries.mutate({
            text: 'I need to finish the project by Friday',
            source: 'test'
        });

        await delay(1000);

        const entry2 = await client.entries.mutate({
            text: 'Meeting with team tomorrow at 2pm',
            source: 'test'
        });

        await delay(1000);

        const entry3 = await client.entries.mutate({
            text: 'Feeling stressed about deadlines',
            source: 'test'
        });

        expect(entry1.entry_id).toBeDefined();
        expect(entry2.entry_id).toBeDefined();
        expect(entry3.entry_id).toBeDefined();

        // Wait for workflows to process
        await delay(10000);

        // Check commitments
        const commitments = await client.commitments.list.query({
            include_history: false
        });

        expect(Array.isArray(commitments)).toBe(true);

        // Check tasks
        const tasks = await client.tasks.list.query({
            include_history: false
        });

        expect(Array.isArray(tasks)).toBe(true);
    });

});

