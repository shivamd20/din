import { db, type Entry } from './db';

// Hard limits from Spec 2.1
const MAX_FOLLOW_UPS_PER_ENTRY = 2;
const MAX_ROUNDS_PER_DAY = 6;

export class FollowUpManager {
    static shouldSuppress(entry: Entry): boolean {
        // 2.2 Entry-Level Suppression
        if (entry.text.length >= 280) return true;
        // Factual clause check is hard on client without NLP, skipping or relying on server AI.
        // Spec says "Entry contains 3+ factual clauses" -> Server AI handles this best.

        // 2.3 User-State Suppression
        if (this.isDailyLimitReached()) return true;
        if (this.isCoolDownActive()) return true;

        return false;
    }

    static isDailyLimitReached(): boolean {
        if (typeof localStorage === 'undefined') return false;

        const today = new Date().toISOString().split('T')[0];
        const key = `din-followups-${today}`;
        const count = parseInt(localStorage.getItem(key) || '0', 10);

        return count >= MAX_ROUNDS_PER_DAY;
    }

    static incrementDailyCount() {
        if (typeof localStorage === 'undefined') return;
        const today = new Date().toISOString().split('T')[0];
        const key = `din-followups-${today}`;
        const count = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, (count + 1).toString());

        // Also set cool-down
        this.setCoolDown();
    }

    private static setCoolDown() {
        // 2.5 Cool-Down Logic: 10 minutes
        const now = Date.now();
        localStorage.setItem('din-followup-cooldown', (now + 10 * 60 * 1000).toString());
    }

    private static isCoolDownActive(): boolean {
        if (typeof localStorage === 'undefined') return false;
        const cooldown = parseInt(localStorage.getItem('din-followup-cooldown') || '0', 10);
        return Date.now() < cooldown;
    }
}
