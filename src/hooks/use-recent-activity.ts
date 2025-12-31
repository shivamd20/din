import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db, type Entry } from '@/lib/db';

const RECENT_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function useRecentActivity() {
    // Query all entries, ordered by creation time (newest first)
    const allEntries = useLiveQuery(
        () => db.entries.orderBy('created_at').reverse().toArray(),
        []
    );

    const result = useMemo(() => {
        if (!allEntries || allEntries.length === 0) {
            return {
                recentEntries: [],
                latestEntry: null,
                count: 0,
                hasUnsynced: false,
                shouldShow: false,
            };
        }

        const now = Date.now();
        const fiveMinutesAgo = now - RECENT_TIME_WINDOW_MS;

        // Filter entries that are:
        // 1. Created within last 5 minutes, OR
        // 2. Unsynced (synced === 0)
        const recentEntries = allEntries.filter((entry: Entry) => {
            const isRecent = entry.created_at >= fiveMinutesAgo;
            const isUnsynced = entry.synced === 0;
            return isRecent || isUnsynced;
        });

        const latestEntry = recentEntries.length > 0 ? recentEntries[0] : null;
        const hasUnsynced = recentEntries.some((entry: Entry) => entry.synced === 0);
        const count = recentEntries.length;
        const shouldShow = count > 0;

        return {
            recentEntries,
            latestEntry,
            count,
            hasUnsynced,
            shouldShow,
        };
    }, [allEntries]);

    return result;
}

