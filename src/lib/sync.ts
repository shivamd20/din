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

// Trigger sync on online event
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log("Online - triggering sync");
        syncQueue();
    });
}
