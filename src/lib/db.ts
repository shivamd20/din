import Dexie, { type EntityTable } from 'dexie';

interface Entry {
    id: string; // UUID
    created_at: number;
    text: string;
    synced: number; // 0 = unsynced, 1 = synced
}

const db = new Dexie('DinDB') as Dexie & {
    entries: EntityTable<Entry, 'id'>;
};

db.version(1).stores({
    entries: 'id, created_at, text, synced' // synced is indexed for fast lookups
});

export { db };
export type { Entry };
