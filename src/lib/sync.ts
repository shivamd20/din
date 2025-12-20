import { db } from './db';
import { trpcClient } from './trpc';

let isSyncing = false;

export async function syncQueue() {
    if (isSyncing || typeof navigator === 'undefined' || !navigator.onLine) return;
    isSyncing = true;

    try {
        const unsynced = await db.entries.where('synced').equals(0).toArray();

        if (unsynced.length === 0) {
            isSyncing = false;
            return;
        }

        // Process serially to maintain order if that matters (FIFO)
        for (const entry of unsynced) {
            try {
                await trpcClient.log.create.mutate({
                    entryId: entry.id,
                    text: entry.text,
                    // Attachments not handled in DB yet, defaulted in schema/mutation
                });

                // Mark as synced
                await db.entries.update(entry.id, { synced: 1 });
            } catch (err) {
                console.error("Sync failed for entry", entry.id, err);
                // Keep synced=0, will retry next time
            }
        }
    } catch (error) {
        console.error("Sync queue error", error);
    } finally {
        isSyncing = false;
    }
}

export async function pullFromServer() {
    if (typeof navigator === 'undefined' || !navigator.onLine) return;

    try {
        console.log("Pulling recent entries from server...");
        // Fetch from tRPC
        const serverEntries = await trpcClient.log.getRecent.query({ limit: 100 });

        // Upsert into Dexie
        // We use bulkPut to efficiently write many items. 
        // Important: We only overwrite if the server version is "newer" or authoritative.
        // For simplicity in Phase 1: Server is authoritative for history.
        // However, we MUST NOT overwrite local unsynced changes (synced=0).

        await db.transaction('rw', db.entries, async () => {
            for (const sEntry of serverEntries) {
                // Check if we have a local version
                const local = await db.entries.get(sEntry.entry_id as string);

                // If local exists and is unsynced, SKIP (Client has pending changes)
                if (local && local.synced === 0) {
                    continue;
                }

                // Otherwise, upsert (New entry OR Overwrite synced entry)
                await db.entries.put({
                    id: sEntry.entry_id as string,
                    created_at: sEntry.created_at as number,
                    text: sEntry.raw_text as string,
                    synced: 1 // It came from server, so it is synced
                });
            }
        });
        console.log(`Pulled ${serverEntries.length} entries.`);
    } catch (err) {
        console.error("Failed to pull from server", err);
    }
}

// Trigger sync on online event
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log("Online - triggering sync");
        syncQueue();
        pullFromServer();
    });
}
