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
                const attachments = entry.attachments || [];
                let hasPendingUploads = false;

                // 1. Upload Attachments
                const updatedAttachments = await Promise.all(attachments.map(async (att) => {
                    // Already uploaded
                    if (att.key) return att;

                    // Missing partial data
                    if (!att.blob) {
                        console.warn("Attachment content missing locally", att.id);
                        return att;
                    }

                    try {
                        const res = await fetch(`/api/upload?key=${att.id}&type=${encodeURIComponent(att.mimeType)}`, {
                            method: 'POST',
                            body: att.blob
                        });

                        if (!res.ok) throw new Error("Upload failed");

                        // Success: Update state
                        // We choose to remove blob to save space, assuming SW caches the URL if accessed,
                        // or we rely on online fetch. 
                        // "Keep stored ... until uploaded" implies cleanup.
                        return { ...att, key: att.id, blob: undefined };
                    } catch (e) {
                        console.error("Upload error for attachment", att.id, e);
                        hasPendingUploads = true;
                        return att;
                    }
                }));

                // Save progress (keys) locally even if others fail
                if (JSON.stringify(updatedAttachments) !== JSON.stringify(attachments)) {
                    await db.entries.update(entry.id, { attachments: updatedAttachments });
                }

                if (hasPendingUploads) {
                    console.log("Entry has pending uploads, skipping items sync", entry.id);
                    continue;
                }

                // 2. Sync Entry to Server
                await trpcClient.log.create.mutate({
                    entryId: entry.id,
                    text: entry.text,
                    attachments: updatedAttachments.map(a => ({
                        id: a.id,
                        key: a.key!,
                        type: a.type,
                        mimeType: a.mimeType,
                        name: a.name
                    }))
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

        await db.transaction('rw', db.entries, async () => {
            for (const sEntry of serverEntries) {
                // Check if we have a local version
                const local = await db.entries.get(sEntry.entry_id as string);

                // If local exists and is unsynced, SKIP (Client has pending changes)
                if (local && local.synced === 0) {
                    continue;
                }

                // Parse attachments
                let attachments = [];
                try {
                    attachments = JSON.parse(sEntry.attachments_json || '[]');
                } catch (e) {
                    console.error("Failed to parse attachments", e);
                }

                // Otherwise, upsert (New entry OR Overwrite synced entry)
                await db.entries.put({
                    id: sEntry.entry_id as string,
                    created_at: sEntry.created_at as number,
                    text: sEntry.raw_text as string,
                    attachments: attachments, // Remote attachments will have keys, no blobs
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
