import { describe, it, expect } from 'vitest';
import { createTestTRPCClient, TEST_USER } from '../utils/trpc-client';

describe('Entries Integration Tests', () => {
    const client = createTestTRPCClient();
    const userId = TEST_USER.id;

    it('should create an entry', async () => {
        const entry = await client.entries.mutate({
            text: 'This is a test entry',
            source: 'test'
        });

        expect(entry.entry_id).toBeDefined();
        expect(typeof entry.entry_id).toBe('string');
        expect(entry.entry_id.length).toBeGreaterThan(0);
    });

    it('should create multiple entries', async () => {
        const entry1 = await client.entries.mutate({
            text: 'First entry',
            source: 'test'
        });

        const entry2 = await client.entries.mutate({
            text: 'Second entry',
            source: 'test'
        });

        expect(entry1.entry_id).toBeDefined();
        expect(entry2.entry_id).toBeDefined();
        expect(entry1.entry_id).not.toBe(entry2.entry_id);
    });

    it('should get recent entries', async () => {
        // Create an entry first
        await client.entries.mutate({
            text: 'Entry for recent test',
            source: 'test'
        });

        const entries = await client.log.getRecent.query({
            limit: 10
        });

        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);
        
        if (entries.length > 0) {
            const entry = entries[0];
            expect(entry).toHaveProperty('entry_id');
            expect(entry).toHaveProperty('created_at');
            expect(entry).toHaveProperty('raw_text');
        }
    });

    it('should get home data', async () => {
        const home = await client.home.query();

        expect(home).toBeDefined();
        expect(home).toHaveProperty('cards');
        expect(home).toHaveProperty('state_snapshot');
        expect(Array.isArray(home.cards)).toBe(true);
        expect(Array.isArray(home.state_snapshot)).toBe(true);
    });
});

