/**
 * Feed Generator Service
 * Pure functions for building, scoring, and ranking feed items
 */

export interface FeedItem {
    id: string;
    type: "task" | "commitment" | "reminder" | "habit" | "reflection" | "affirmation";
    title: string;
    description: string;
    urgency: number;        // 0 - 1
    importance: number;     // 0 - 1
    time_context: string;   // morning, evening, weekend, workday, etc
    reason: string;
    suggested_actions: string[];
    timing: string;         // now, soon, today, this-week, someday
    related_capture_summary?: string;
    deadline?: number | null;
    duration_estimate?: number | null;
}

interface Task {
    id: string;
    content: string;
    status: string;
    priority?: string | null;
    due_date?: number | null;
    created_at: number;
}

interface Commitment {
    id: string;
    content: string;
    strength: string;
    horizon: string;
    status: string;
    created_at: number;
}

interface Signal {
    id: string;
    entry_id: string;
    key: string;
    value: number;
    confidence: number;
    generated_at: number;
}

/**
 * Build candidate feed items from tasks, commitments, and signals
 */
export function buildCandidates(
    tasks: Task[],
    commitments: Commitment[],
    signals: Signal[]
): FeedItem[] {
    const candidates: FeedItem[] = [];

    // Transform tasks
    tasks.forEach(task => {
        if (task.status === 'completed' || task.status === 'cancelled') {
            return; // Skip completed/cancelled tasks
        }

        const now = Date.now();
        const daysUntilDue = task.due_date 
            ? Math.ceil((task.due_date - now) / (1000 * 60 * 60 * 24))
            : null;

        // Determine urgency based on due date
        let urgency = 0.3; // Default
        let timing = 'someday';
        
        if (daysUntilDue !== null) {
            if (daysUntilDue < 0) {
                urgency = 1.0; // Overdue
                timing = 'now';
            } else if (daysUntilDue === 0) {
                urgency = 0.9;
                timing = 'now';
            } else if (daysUntilDue <= 1) {
                urgency = 0.8;
                timing = 'today';
            } else if (daysUntilDue <= 7) {
                urgency = 0.6;
                timing = 'this-week';
            } else {
                urgency = 0.4;
                timing = 'soon';
            }
        }

        // Determine importance from priority
        let importance = 0.5; // Default
        if (task.priority === 'high') {
            importance = 0.9;
        } else if (task.priority === 'medium') {
            importance = 0.6;
        } else if (task.priority === 'low') {
            importance = 0.3;
        }

        // Determine time context from current time
        const hour = new Date().getHours();
        let timeContext = 'workday';
        if (hour < 9) {
            timeContext = 'morning';
        } else if (hour >= 17 && hour < 20) {
            timeContext = 'evening';
        } else if (hour >= 20) {
            timeContext = 'night';
        }
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            timeContext = 'weekend';
        }

        candidates.push({
            id: `task-${task.id}`,
            type: 'task',
            title: 'Task',
            description: task.content,
            urgency,
            importance,
            time_context: timeContext,
            reason: `Task with ${task.priority || 'default'} priority${daysUntilDue !== null ? `, due in ${daysUntilDue} days` : ''}`,
            suggested_actions: ['complete', 'snooze', 'skip'],
            timing,
            deadline: task.due_date || null,
            duration_estimate: null
        });
    });

    // Transform commitments
    commitments.forEach(commitment => {
        if (commitment.status !== 'active') {
            return; // Only active commitments
        }

        // Determine importance from strength
        let importance = 0.5;
        if (commitment.strength === 'strong') {
            importance = 0.9;
        } else if (commitment.strength === 'medium') {
            importance = 0.6;
        } else if (commitment.strength === 'weak') {
            importance = 0.3;
        }

        // Urgency based on horizon
        let urgency = 0.4;
        let timing = 'soon';
        if (commitment.horizon === 'short') {
            urgency = 0.7;
            timing = 'today';
        } else if (commitment.horizon === 'medium') {
            urgency = 0.5;
            timing = 'this-week';
        } else {
            urgency = 0.3;
            timing = 'someday';
        }

        const hour = new Date().getHours();
        let timeContext = 'workday';
        if (hour < 9) {
            timeContext = 'morning';
        } else if (hour >= 17 && hour < 20) {
            timeContext = 'evening';
        } else if (hour >= 20) {
            timeContext = 'night';
        }
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            timeContext = 'weekend';
        }

        candidates.push({
            id: `commitment-${commitment.id}`,
            type: 'commitment',
            title: 'Commitment',
            description: commitment.content,
            urgency,
            importance,
            time_context: timeContext,
            reason: `${commitment.strength} commitment with ${commitment.horizon} horizon`,
            suggested_actions: ['acknowledge', 'snooze', 'skip'],
            timing,
            deadline: null,
            duration_estimate: null
        });
    });

    // Transform signals into reminders/habits
    // Group signals by entry_id to create reminders
    const signalsByEntry = new Map<string, Signal[]>();
    signals.forEach(signal => {
        if (!signalsByEntry.has(signal.entry_id)) {
            signalsByEntry.set(signal.entry_id, []);
        }
        signalsByEntry.get(signal.entry_id)!.push(signal);
    });

    signalsByEntry.forEach((entrySignals, entryId) => {
        // Calculate average actionability and temporal_proximity
        const actionabilitySignals = entrySignals.filter(s => s.key === 'actionability');
        const temporalSignals = entrySignals.filter(s => s.key === 'temporal_proximity');
        const habitSignals = entrySignals.filter(s => s.key === 'habit_likelihood');

        if (actionabilitySignals.length > 0) {
            const avgActionability = actionabilitySignals.reduce((sum, s) => sum + s.value, 0) / actionabilitySignals.length;
            const avgTemporal = temporalSignals.length > 0
                ? temporalSignals.reduce((sum, s) => sum + s.value, 0) / temporalSignals.length
                : 0.5;

            if (avgActionability > 0.6) {
                // High actionability = reminder
                candidates.push({
                    id: `reminder-${entryId}`,
                    type: 'reminder',
                    title: 'Reminder',
                    description: `Actionable item from your captures`,
                    urgency: avgTemporal,
                    importance: avgActionability,
                    time_context: getTimeContext(),
                    reason: `High actionability (${(avgActionability * 100).toFixed(0)}%) signal`,
                    suggested_actions: ['start', 'snooze', 'skip'],
                    timing: avgTemporal > 0.7 ? 'now' : avgTemporal > 0.5 ? 'today' : 'soon',
                    deadline: null,
                    duration_estimate: null
                });
            }
        }

        if (habitSignals.length > 0) {
            const avgHabit = habitSignals.reduce((sum, s) => sum + s.value, 0) / habitSignals.length;
            if (avgHabit > 0.6) {
                // High habit likelihood = habit reminder
                candidates.push({
                    id: `habit-${entryId}`,
                    type: 'habit',
                    title: 'Habit',
                    description: `Habitual activity detected`,
                    urgency: 0.5,
                    importance: avgHabit,
                    time_context: getTimeContext(),
                    reason: `High habit likelihood (${(avgHabit * 100).toFixed(0)}%)`,
                    suggested_actions: ['done', 'skip'],
                    timing: 'now',
                    deadline: null,
                    duration_estimate: null
                });
            }
        }
    });

    return candidates;
}

/**
 * Score items based on urgency, importance, and time alignment
 */
export function scoreItems(items: FeedItem[], currentTime: number): FeedItem[] {
    const hour = new Date(currentTime).getHours();
    const dayOfWeek = new Date(currentTime).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return items.map(item => {
        // Calculate time alignment (0-1)
        let timeAlignment = 0.5; // Default

        if (item.time_context === 'morning' && hour >= 6 && hour < 9) {
            timeAlignment = 1.0;
        } else if (item.time_context === 'evening' && hour >= 17 && hour < 20) {
            timeAlignment = 1.0;
        } else if (item.time_context === 'night' && hour >= 20) {
            timeAlignment = 1.0;
        } else if (item.time_context === 'weekend' && isWeekend) {
            timeAlignment = 1.0;
        } else if (item.time_context === 'workday' && !isWeekend && hour >= 9 && hour < 17) {
            timeAlignment = 1.0;
        } else {
            // Partial alignment
            timeAlignment = 0.3;
        }

        // Calculate final score
        const score = (item.urgency * 0.5) + (item.importance * 0.4) + (timeAlignment * 0.1);
        
        return {
            ...item,
            // Store score in a temporary field for sorting (we'll remove it later)
            score
        } as FeedItem & { score: number };
    });
}

/**
 * Rank items by score (highest first)
 */
export function rankItems(items: (FeedItem & { score: number })[]): FeedItem[] {
    return items
        .sort((a, b) => b.score - a.score)
        .map(({ score, ...item }) => item); // Remove score field
}

/**
 * Prepare feed items for LLM request
 */
export function prepareLLMRequest(
    rankedItems: FeedItem[],
    currentTime: number,
    userContext?: string
): {
    currentTime: string;
    userContext?: string;
    feedItems: FeedItem[];
} {
    return {
        currentTime: new Date(currentTime).toISOString(),
        userContext,
        feedItems: rankedItems.slice(0, 10) // Top 10 items
    };
}

/**
 * Helper to get current time context
 */
function getTimeContext(): string {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'weekend';
    }
    if (hour < 9) {
        return 'morning';
    }
    if (hour >= 17 && hour < 20) {
        return 'evening';
    }
    if (hour >= 20) {
        return 'night';
    }
    return 'workday';
}

