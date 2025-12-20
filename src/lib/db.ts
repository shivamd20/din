import Dexie, { type EntityTable } from 'dexie';

interface Attachment {
    id: string;
    type: 'image' | 'video' | 'file';
    mimeType: string;
    name?: string;
    blob?: Blob; // Local binary data
    key?: string; // Remote R2 key
}

interface Entry {
    id: string; // UUID
    rootId: string; // entries group by this. For root entries, rootId == id
    parentId?: string; // for threading depth. undefined for root.
    created_at: number;
    text: string;
    attachments?: Attachment[];
    synced: number; // 0 = unsynced, 1 = synced

    // Follow-Up Provenance (Local only until synced)
    followUp?: {
        chipId: string;
        chipLabel: string;
        generationId: string;
    };

    // Suggestions from AI (Transient)
    transientSuggestions?: { chipId: string; chipLabel: string; generationId: string }[];
    transientAnalysis?: string;
}

const db = new Dexie('DinDB') as Dexie & {
    entries: EntityTable<Entry, 'id'>;
};

// Version 2: Add indices for threading
db.version(2).stores({
    entries: 'id, rootId, parentId, created_at, text, synced' // Added rootId, parentId indices
});

// Version 1 (Keep for history/reference)
db.version(1).stores({
    entries: 'id, created_at, text, synced'
});

export { db };
export type { Entry, Attachment };
