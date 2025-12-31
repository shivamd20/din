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
                // Emit sync start event
                const syncStartEvent = new CustomEvent('sync:start', {
                    detail: { entryId: entry.id }
                });
                window.dispatchEvent(syncStartEvent);

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
                const result = await trpcClient.log.create.mutate({
                    entryId: entry.id,
                    text: entry.text,
                    attachments: updatedAttachments.map(a => ({
                        id: a.id,
                        key: a.key!,
                        type: a.type,
                        mimeType: a.mimeType,
                        name: a.name
                    })),
                    rootId: entry.rootId,
                    parentId: entry.parentId,
                    // pass followUp provenance if it exists
                    followUp: entry.followUp
                });

                // Mark as synced AND save any followUps returned
                let updates: any = { synced: 1 };

                if (result.followUps && result.followUps.length > 0) {
                    // We store them in a temporary field or rely on App.tsx finding them?
                    // Db schema doesn't have 'suggestedChips'.
                    // WE need to add it to DB 'entries' or 'temp_state'.
                    // For now, let's append them to a new field 'generated_suggestions' in Entry?
                    // Or, since App.tsx is waiting, we can broadcast?
                    // Dexie liveQuery would update if we save to DB.
                    // Let's add 'generated_suggestions' to Entry interface in DB?
                    // Actually, I'll store it in `follow_up_provenance_json` or similar? 
                    // No, that's for what WAS clicked.

                    // I will hack: Add `transientSuggestions` to Entry interface.
                    updates.transientSuggestions = result.followUps;
                }

                if ((result as any).analysis) {
                    updates.transientAnalysis = (result as any).analysis;
                }

                await db.entries.update(entry.id, updates);

                // Emit sync complete event
                const syncCompleteEvent = new CustomEvent('sync:complete', {
                    detail: { entryId: entry.id }
                });
                window.dispatchEvent(syncCompleteEvent);
            } catch (err) {
                console.error("Sync failed for entry", entry.id, err);
                // Keep synced=0, will retry next time
                
                // Emit sync error event
                const syncErrorEvent = new CustomEvent('sync:error', {
                    detail: { entryId: entry.id }
                });
                window.dispatchEvent(syncErrorEvent);
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
                const local = await db.entries.get(String(sEntry.entry_id));

                // If local exists and is unsynced, SKIP (Client has pending changes)
                if (local && local.synced === 0) {
                    continue;
                }

                // Parse attachments
                let attachments = [];
                try {
                    const attachmentsJson = sEntry.attachments_json;
                    attachments = JSON.parse(typeof attachmentsJson === 'string' ? attachmentsJson : '[]');
                } catch (e) {
                    console.error("Failed to parse attachments", e);
                }

                // Otherwise, upsert (New entry OR Overwrite synced entry)
                await db.entries.put({
                    id: String(sEntry.entry_id),
                    created_at: sEntry.created_at as number,
                    text: sEntry.raw_text as string,
                    attachments: attachments, // Remote attachments will have keys, no blobs
                    synced: 1, // It came from server, so it is synced
                    rootId: (sEntry.root_id ? String(sEntry.root_id) : null) || String(sEntry.entry_id),
                    parentId: sEntry.parent_id ? String(sEntry.parent_id) : undefined
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
