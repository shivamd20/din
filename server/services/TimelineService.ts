import type { Task, Commitment, Entry } from '../db/daos';
import type { FeedItemRendered } from '../UserDO';

export interface TimelineItem {
    id: string;
    item_type: 'task';
    content: string;
    status: 'completed' | 'missed' | 'adjusted';
    completed_at: number | null;
    time_spent_minutes: number;
    planned_duration_minutes: number;
    commitment_id: string | null;
    commitment_content: string | null;
    contextual_note: string | null;
    why_missed: string | null;
    contributed_to_streak: boolean;
    broke_streak: boolean;
    created_at: number;
}

export interface TimelineEntryItem {
    id: string;
    item_type: 'entry';
    content: string; // entry.text
    created_at: number;
    action_type: string | null;
    action_context: Record<string, unknown> | null;
    feed_item_id: string | null;
    event_type: string | null;
    linked_task_id: string | null;
    linked_commitment_id: string | null;
    commitment_content: string | null;
    // Visual metadata
    action_title?: string; // From action_context.action_title
    card_content?: string; // From action_context.card_content
    generation_reason?: string; // From action_context.generation_reason
}

export interface TodayItem {
    id: string;
    type: 'feed_item' | 'suppressed_task';
    content: string;
    priority_score?: number;
    generation_reason?: string;
    suppression_reason?: string;
    related_commitment_id: string | null;
    related_commitment_content: string | null;
    related_task_id: string | null;
    feed_item?: FeedItemRendered;
}

export interface FutureProjection {
    id: string;
    content: string;
    projection_type: 'planned_by_system' | 'expected_milestone' | 'auto_prediction' | 'recurring_habit_slot';
    confidence_score: number;
    why_it_exists: string;
    when_materializes: number;
    related_commitment_id: string;
    related_commitment_content: string;
    pattern_marker?: string; // e.g., "Daily: Exercise"
    cadence_days?: number;
}

export interface PatternInsight {
    pattern_type: string;
    description: string;
    confidence: number;
    identity_focused: boolean;
}

export interface StreakSummary {
    commitment_id: string | null;
    commitment_content: string | null;
    current_streak: number;
    longest_streak: number;
    type: 'per_commitment' | 'aggregate' | 'identity_pattern';
    description: string;
}

export type TimelinePastItem = TimelineItem | TimelineEntryItem;

export interface TimelineData {
    past: TimelinePastItem[];
    today: TodayItem[];
    future: FutureProjection[];
    insights: {
        patterns: PatternInsight[];
        streaks: StreakSummary[];
        identity_hints: string[];
    };
}

export interface TimelineFilters {
    commitment_id?: string;
    category?: 'work' | 'personal' | 'health';
    time_horizon?: 'week' | 'month' | 'quarter';
}

/**
 * Service for building timeline data (Past/Today/Future)
 */
export class TimelineService {
    /**
     * Build complete timeline data
     */
    buildTimeline(
        userId: string,
        allTasks: Task[],
        allCommitments: Commitment[],
        allEntries: Entry[],
        currentFeed: FeedItemRendered[],
        filters?: TimelineFilters
    ): TimelineData {
        // Apply filters
        const filteredTasks = this.applyFilters(allTasks, allCommitments, filters);
        const filteredCommitments = this.applyCommitmentFilters(allCommitments, filters);

        // Build sections
        const past = this.buildPastSection(filteredTasks, allEntries, allCommitments);
        const today = this.buildTodaySection(currentFeed, filteredTasks, allCommitments);
        const future = this.buildFutureSection(filteredCommitments, allTasks);
        
        // Generate insights
        const patterns = this.detectPatterns(past, allTasks, allEntries);
        const streaks = this.aggregateStreaks(allCommitments, past);
        const identityHints = this.generateIdentityHints(patterns, streaks, past);

        return {
            past,
            today,
            future,
            insights: {
                patterns,
                streaks,
                identity_hints: identityHints,
            },
        };
    }

    /**
     * Build entry timeline items from entries
     */
    private buildEntryTimelineItems(
        entries: Entry[],
        commitments: Commitment[]
    ): TimelineEntryItem[] {
        const entryItems: TimelineEntryItem[] = [];

        for (const entry of entries) {
            // Parse action_context if present
            let actionContext: Record<string, unknown> | null = null;
            let actionTitle: string | undefined;
            let cardContent: string | undefined;
            let generationReason: string | undefined;

            if (entry.action_context) {
                try {
                    actionContext = typeof entry.action_context === 'string'
                        ? JSON.parse(entry.action_context)
                        : entry.action_context as Record<string, unknown>;
                    
                    if (actionContext) {
                        actionTitle = actionContext.action_title as string | undefined;
                        cardContent = actionContext.card_content as string | undefined;
                        generationReason = actionContext.generation_reason as string | undefined;
                    }
                } catch {
                    // Invalid JSON, skip action_context
                }
            }

            // Find related commitment
            const commitment = entry.linked_commitment_id
                ? commitments.find(c => c.id === entry.linked_commitment_id)
                : null;

            entryItems.push({
                id: entry.id,
                item_type: 'entry',
                content: entry.text,
                created_at: entry.created_at,
                action_type: entry.action_type,
                action_context: actionContext,
                feed_item_id: entry.feed_item_id,
                event_type: entry.event_type,
                linked_task_id: entry.linked_task_id,
                linked_commitment_id: entry.linked_commitment_id,
                commitment_content: commitment?.content || null,
                action_title: actionTitle,
                card_content: cardContent,
                generation_reason: generationReason,
            });
        }

        return entryItems;
    }

    /**
     * Build Past section from completed/abandoned tasks and entries
     */
    private buildPastSection(
        tasks: Task[],
        entries: Entry[],
        commitments: Commitment[]
    ): TimelinePastItem[] {
        const now = Date.now();
        const pastItems: TimelinePastItem[] = [];

        // Get all task versions, group by content, take latest version
        const taskMap = new Map<string, Task>();
        for (const task of tasks) {
            const key = task.content.toLowerCase().trim();
            const existing = taskMap.get(key);
            if (!existing || task.created_at > existing.created_at) {
                taskMap.set(key, task);
            }
        }

        // Process completed and abandoned tasks
        for (const task of taskMap.values()) {
            if (task.status === 'completed' || task.status === 'abandoned') {
                const commitment = task.commitment_id
                    ? commitments.find(c => c.id === task.commitment_id)
                    : null;

                // Find related entries for context
                const relatedEntries = entries.filter(
                    e => e.linked_task_id === task.id || e.id === task.origin_entry_id
                );

                // Determine if missed or completed
                const isMissed = task.status === 'abandoned' || 
                    (task.planned_date && task.planned_date < now && task.status !== 'completed');

                // Convert undefined to null for commitment
                const commitmentOrNull = commitment ?? null;

                // Detect streak contribution
                const contributedToStreak = this.didContributeToStreak(task, commitmentOrNull, entries);
                const brokeStreak = this.didBreakStreak(task, commitmentOrNull, entries);

                // Generate contextual note
                const contextualNote = this.generateContextualNote(task, relatedEntries, commitmentOrNull);
                const whyMissed = isMissed ? this.generateWhyMissed(task, relatedEntries) : null;

                pastItems.push({
                    id: task.id,
                    item_type: 'task',
                    content: task.content,
                    status: task.status === 'completed' ? 'completed' : isMissed ? 'missed' : 'adjusted',
                    completed_at: task.status === 'completed' ? task.created_at : null,
                    time_spent_minutes: task.time_spent_minutes,
                    planned_duration_minutes: task.duration_minutes,
                    commitment_id: task.commitment_id,
                    commitment_content: commitment?.content || null,
                    contextual_note: contextualNote,
                    why_missed: whyMissed,
                    contributed_to_streak: contributedToStreak,
                    broke_streak: brokeStreak,
                    created_at: task.created_at,
                });
            }
        }

        // Build entry timeline items
        const entryItems = this.buildEntryTimelineItems(entries, commitments);

        // Merge entry items with task items
        pastItems.push(...entryItems);

        // Sort by date (most recent first)
        return pastItems.sort((a, b) => b.created_at - a.created_at);
    }

    /**
     * Build Today section from feed items and suppressed tasks
     */
    private buildTodaySection(
        feedItems: FeedItemRendered[],
        tasks: Task[],
        commitments: Commitment[]
    ): TodayItem[] {
        const now = Date.now();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEnd = tomorrow.getTime();

        const todayItems: TodayItem[] = [];

        // Add feed items
        for (const feedItem of feedItems) {
            const commitment = feedItem.related_commitment_id
                ? commitments.find(c => c.id === feedItem.related_commitment_id)
                : null;

            todayItems.push({
                id: feedItem.id,
                type: 'feed_item',
                content: feedItem.phrasing,
                priority_score: feedItem.priority_score,
                generation_reason: feedItem.generation_reason,
                related_commitment_id: feedItem.related_commitment_id || null,
                related_commitment_content: commitment?.content || null,
                related_task_id: feedItem.related_task_id || null,
                feed_item: feedItem,
            });
        }

        // Find suppressed tasks (planned tasks for today not in feed)
        const feedTaskIds = new Set(
            feedItems
                .map(item => item.related_task_id)
                .filter((id): id is string => id !== null && id !== undefined)
        );

        const suppressedTasks = tasks.filter(
            task =>
                task.status === 'planned' &&
                task.planned_date &&
                task.planned_date >= todayStart &&
                task.planned_date < todayEnd &&
                !feedTaskIds.has(task.id)
        );

        for (const task of suppressedTasks) {
            const commitment = task.commitment_id
                ? commitments.find(c => c.id === task.commitment_id)
                : null;

            const suppressionReason = this.generateSuppressionReason(task, now);

            todayItems.push({
                id: `suppressed-${task.id}`,
                type: 'suppressed_task',
                content: task.content,
                suppression_reason: suppressionReason,
                related_commitment_id: task.commitment_id,
                related_commitment_content: commitment?.content || null,
                related_task_id: task.id,
            });
        }

        return todayItems;
    }

    /**
     * Build Future section from active commitments
     */
    private buildFutureSection(
        commitments: Commitment[],
        existingTasks: Task[]
    ): FutureProjection[] {
        const now = Date.now();
        const projections: FutureProjection[] = [];

        // Only process active commitments
        const activeCommitments = commitments.filter(
            c => c.status === 'active' || c.status === 'confirmed'
        );

        for (const commitment of activeCommitments) {
            const commitmentProjections = this.projectFromCommitment(commitment, existingTasks, now);
            projections.push(...commitmentProjections);
        }

        // Sort by when_materializes
        return projections.sort((a, b) => a.when_materializes - b.when_materializes);
    }

    /**
     * Project future tasks from a commitment
     */
    private projectFromCommitment(
        commitment: Commitment,
        existingTasks: Task[],
        now: number
    ): FutureProjection[] {
        const projections: FutureProjection[] = [];

        if (!commitment.time_horizon_type) {
            // No time horizon, skip
            return [];
        }

        const confidenceScore = this.calculateConfidenceScore(commitment, existingTasks);

        switch (commitment.time_horizon_type) {
            case 'daily':
                // Show pattern marker for next 7-14 days
                for (let i = 1; i <= 14; i++) {
                    const dateObj = new Date(now);
                    dateObj.setDate(dateObj.getDate() + i);
                    dateObj.setHours(0, 0, 0, 0);
                    const date = dateObj.getTime();
                    projections.push({
                        id: `proj-${commitment.id}-${i}`,
                        content: commitment.content,
                        projection_type: 'recurring_habit_slot',
                        confidence_score: confidenceScore,
                        why_it_exists: `Daily habit: ${commitment.content}. This supports your commitment to build consistency.`,
                        when_materializes: date,
                        related_commitment_id: commitment.id,
                        related_commitment_content: commitment.content,
                        pattern_marker: `Daily: ${commitment.content}`,
                        cadence_days: 1,
                    });
                }
                break;

            case 'weekly':
                // Show next 4-8 occurrences
                const weeklyCount = 8;
                for (let i = 1; i <= weeklyCount; i++) {
                    const dateObj = new Date(now);
                    dateObj.setDate(dateObj.getDate() + (i * 7));
                    dateObj.setHours(0, 0, 0, 0);
                    const date = dateObj.getTime();
                    projections.push({
                        id: `proj-${commitment.id}-week-${i}`,
                        content: commitment.content,
                        projection_type: 'recurring_habit_slot',
                        confidence_score: confidenceScore,
                        why_it_exists: `Weekly commitment: ${commitment.content}. This maintains your progress toward your goal.`,
                        when_materializes: date,
                        related_commitment_id: commitment.id,
                        related_commitment_content: commitment.content,
                        pattern_marker: `Weekly: ${commitment.content}`,
                        cadence_days: commitment.cadence_days || 7,
                    });
                }
                break;

            case 'monthly':
                // Show next 3-6 occurrences
                const monthlyCount = 6;
                for (let i = 1; i <= monthlyCount; i++) {
                    const dateObj = new Date(now);
                    dateObj.setMonth(dateObj.getMonth() + i);
                    dateObj.setHours(0, 0, 0, 0);
                    const date = dateObj.getTime();
                    projections.push({
                        id: `proj-${commitment.id}-month-${i}`,
                        content: commitment.content,
                        projection_type: 'recurring_habit_slot',
                        confidence_score: confidenceScore,
                        why_it_exists: `Monthly commitment: ${commitment.content}. This keeps you on track for your long-term goal.`,
                        when_materializes: date,
                        related_commitment_id: commitment.id,
                        related_commitment_content: commitment.content,
                        pattern_marker: `Monthly: ${commitment.content}`,
                        cadence_days: commitment.cadence_days || 30,
                    });
                }
                break;

            case 'date':
                // Generate milestone tasks leading up to deadline
                if (commitment.time_horizon_value && commitment.time_horizon_value > now) {
                    const deadline = commitment.time_horizon_value;
                    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                    
                    // Generate 3-5 milestone tasks
                    const milestoneCount = Math.min(5, Math.max(3, Math.floor(daysUntilDeadline / 7)));
                    for (let i = 1; i <= milestoneCount; i++) {
                        const progress = i / (milestoneCount + 1);
                        const date = now + (deadline - now) * progress;
                        projections.push({
                            id: `proj-${commitment.id}-milestone-${i}`,
                            content: `Milestone ${i}: ${commitment.content}`,
                            projection_type: 'expected_milestone',
                            confidence_score: confidenceScore,
                            why_it_exists: `Progress milestone toward your deadline. This helps you stay on track.`,
                            when_materializes: date,
                            related_commitment_id: commitment.id,
                            related_commitment_content: commitment.content,
                        });
                    }
                }
                break;

            case 'continuous':
            case 'maintain':
                // Show recurring pattern markers
                const cadence = commitment.cadence_days || 7;
                const continuousCount = 12; // Show next 12 occurrences
                for (let i = 1; i <= continuousCount; i++) {
                    const dateObj = new Date(now);
                    dateObj.setDate(dateObj.getDate() + (i * cadence));
                    dateObj.setHours(0, 0, 0, 0);
                    const date = dateObj.getTime();
                    projections.push({
                        id: `proj-${commitment.id}-maintain-${i}`,
                        content: commitment.content,
                        projection_type: 'recurring_habit_slot',
                        confidence_score: confidenceScore,
                        why_it_exists: `Maintenance task: ${commitment.content}. This keeps your system running smoothly.`,
                        when_materializes: date,
                        related_commitment_id: commitment.id,
                        related_commitment_content: commitment.content,
                        pattern_marker: `Every ${cadence} days: ${commitment.content}`,
                        cadence_days: cadence,
                    });
                }
                break;
        }

        return projections;
    }

    /**
     * Detect patterns in past behavior
     */
    private detectPatterns(
        pastItems: TimelinePastItem[],
        allTasks: Task[],
        entries: Entry[]
    ): PatternInsight[] {
        const insights: PatternInsight[] = [];

        // Day of week patterns (only for task items)
        const dayOfWeekCounts = new Map<number, { completed: number; missed: number }>();
        for (const item of pastItems) {
            if (item.item_type === 'task') {
                if (item.completed_at) {
                    const date = new Date(item.completed_at);
                    const dayOfWeek = date.getDay();
                    const counts = dayOfWeekCounts.get(dayOfWeek) || { completed: 0, missed: 0 };
                    counts.completed++;
                    dayOfWeekCounts.set(dayOfWeek, counts);
                } else if (item.status === 'missed') {
                    const date = new Date(item.created_at);
                    const dayOfWeek = date.getDay();
                    const counts = dayOfWeekCounts.get(dayOfWeek) || { completed: 0, missed: 0 };
                    counts.missed++;
                    dayOfWeekCounts.set(dayOfWeek, counts);
                }
            }
        }

        // Find patterns
        for (const [dayOfWeek, counts] of dayOfWeekCounts.entries()) {
            const total = counts.completed + counts.missed;
            if (total >= 3) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayName = dayNames[dayOfWeek];
                const completionRate = counts.completed / total;

                if (completionRate > 0.7) {
                    insights.push({
                        pattern_type: 'day_of_week_consistency',
                        description: `You consistently complete tasks on ${dayName}s. This shows strong weekday reliability.`,
                        confidence: completionRate,
                        identity_focused: true,
                    });
                } else if (completionRate < 0.3) {
                    insights.push({
                        pattern_type: 'day_of_week_struggle',
                        description: `You usually struggle with tasks on ${dayName}s. Consider lighter follow-up tasks on these days.`,
                        confidence: 1 - completionRate,
                        identity_focused: false,
                    });
                }
            }
        }

        // Streak patterns (only for task items)
        let currentStreak = 0;
        let maxStreak = 0;
        for (const item of pastItems.slice().reverse()) {
            if (item.item_type === 'task') {
                if (item.status === 'completed') {
                    currentStreak++;
                    maxStreak = Math.max(maxStreak, currentStreak);
                } else if (item.status === 'missed') {
                    currentStreak = 0;
                }
            }
        }

        if (maxStreak >= 7) {
            insights.push({
                pattern_type: 'streak_consistency',
                description: `You've maintained a ${maxStreak}-day streak. This pattern shows strong consistency and reliability.`,
                confidence: Math.min(1, maxStreak / 30),
                identity_focused: true,
            });
        }

        return insights;
    }

    /**
     * Aggregate streaks across commitments
     */
    private aggregateStreaks(
        commitments: Commitment[],
        pastItems: TimelinePastItem[]
    ): StreakSummary[] {
        const summaries: StreakSummary[] = [];

        // Per-commitment streaks
        for (const commitment of commitments) {
            if (commitment.streak_count !== null && commitment.streak_count > 0) {
                summaries.push({
                    commitment_id: commitment.id,
                    commitment_content: commitment.content,
                    current_streak: commitment.streak_count,
                    longest_streak: commitment.longest_streak || commitment.streak_count,
                    type: 'per_commitment',
                    description: `You're on a ${commitment.streak_count}-day streak for "${commitment.content}". Keep going!`,
                });
            }
        }

        // Aggregate streaks (across related commitments)
        const commitmentStreaks = commitments
            .filter(c => c.streak_count !== null && c.streak_count > 0)
            .map(c => c.streak_count!);

        if (commitmentStreaks.length > 1) {
            const avgStreak = commitmentStreaks.reduce((a, b) => a + b, 0) / commitmentStreaks.length;
            summaries.push({
                commitment_id: null,
                commitment_content: null,
                current_streak: Math.round(avgStreak),
                longest_streak: Math.max(...commitmentStreaks),
                type: 'aggregate',
                description: `You're maintaining consistency across ${commitmentStreaks.length} commitments. You're building reliability.`,
            });
        }

        return summaries;
    }

    /**
     * Generate identity-focused hints
     */
    private generateIdentityHints(
        patterns: PatternInsight[],
        streaks: StreakSummary[],
        pastItems: TimelinePastItem[]
    ): string[] {
        const hints: string[] = [];

        // From patterns
        const strongPatterns = patterns.filter(p => p.confidence > 0.7 && p.identity_focused);
        for (const pattern of strongPatterns) {
            hints.push(pattern.description);
        }

        // From streaks
        const strongStreaks = streaks.filter(s => s.current_streak >= 7);
        for (const streak of strongStreaks) {
            hints.push(streak.description);
        }

        // General encouragement (only count task items)
        const taskItems = pastItems.filter((i): i is TimelineItem => i.item_type === 'task');
        const completionRate = taskItems.filter(i => i.status === 'completed').length / Math.max(1, taskItems.length);
        if (completionRate > 0.6) {
            hints.push("You're becoming someone who finishes things. Keep building this identity.");
        }

        return hints;
    }

    /**
     * Apply filters to tasks
     */
    private applyFilters(
        tasks: Task[],
        commitments: Commitment[],
        filters?: TimelineFilters
    ): Task[] {
        let filtered = tasks;

        if (filters?.commitment_id) {
            filtered = filtered.filter(t => t.commitment_id === filters.commitment_id);
        }

        if (filters?.category) {
            // Filter by commitment category (would need category field on commitments)
            // For now, skip category filtering
        }

        if (filters?.time_horizon) {
            const now = Date.now();
            const horizonMs = {
                week: 7 * 24 * 60 * 60 * 1000,
                month: 30 * 24 * 60 * 60 * 1000,
                quarter: 90 * 24 * 60 * 60 * 1000,
            }[filters.time_horizon];

            filtered = filtered.filter(t => {
                if (!t.planned_date) return false;
                return t.planned_date >= now && t.planned_date <= now + horizonMs;
            });
        }

        return filtered;
    }

    /**
     * Apply filters to commitments
     */
    private applyCommitmentFilters(
        commitments: Commitment[],
        filters?: TimelineFilters
    ): Commitment[] {
        let filtered = commitments;

        if (filters?.commitment_id) {
            filtered = filtered.filter(c => c.id === filters.commitment_id);
        }

        return filtered;
    }

    // Helper methods

    private didContributeToStreak(task: Task, commitment: Commitment | null, entries: Entry[]): boolean {
        if (!commitment || task.status !== 'completed') return false;
        // Check if this task completion contributed to commitment streak
        // This is a simplified check - in reality, would need to check commitment's streak logic
        return commitment.streak_count !== null && commitment.streak_count > 0;
    }

    private didBreakStreak(task: Task, commitment: Commitment | null, entries: Entry[]): boolean {
        if (!commitment || task.status !== 'abandoned') return false;
        // Check if this task abandonment broke a streak
        return false; // Simplified
    }

    private generateContextualNote(task: Task, entries: Entry[], commitment: Commitment | null): string | null {
        // Find entry that completed the task
        const completionEntry = entries.find(e => 
            e.linked_task_id === task.id && 
            (e.event_type === 'task_finish' || e.text.toLowerCase().includes('completed'))
        );

        if (completionEntry) {
            return `Completed: ${completionEntry.text.substring(0, 100)}`;
        }

        return null;
    }

    private generateWhyMissed(task: Task, entries: Entry[]): string | null {
        // Find entry that explains why it was missed
        const skipEntry = entries.find(e => 
            e.linked_task_id === task.id && 
            (e.event_type === 'task_skip' || e.text.toLowerCase().includes('skip'))
        );

        if (skipEntry) {
            return skipEntry.text.substring(0, 150);
        }

        // Default explanations
        if (task.planned_date && task.planned_date < Date.now()) {
            return "This task was planned but not completed. It may have been deprioritized or rescheduled.";
        }

        return null;
    }

    private generateSuppressionReason(task: Task, now: number): string {
        const hour = new Date(now).getHours();
        const plannedHour = task.planned_date ? new Date(task.planned_date).getHours() : null;

        // Time-based suppression
        if (plannedHour !== null) {
            if (plannedHour >= 17 && hour < 12) {
                return "Hidden because your energy is likely low at this hour. Evening tasks are better suited for later in the day.";
            }
            if (plannedHour < 12 && hour >= 17) {
                return "Deferred to align with your daily rhythm. Morning tasks are typically more effective earlier.";
            }
        }

        // Default
        return "This task exists but is not prioritized in your feed right now. The system will surface it when the timing is optimal.";
    }

    private calculateConfidenceScore(commitment: Commitment, existingTasks: Task[]): number {
        let score = 0.5; // Base score

        // Boost based on commitment strength
        if (commitment.streak_count !== null && commitment.streak_count > 0) {
            score += Math.min(0.3, commitment.streak_count / 30);
        }

        // Boost based on existing related tasks
        const relatedTasks = existingTasks.filter(t => t.commitment_id === commitment.id);
        if (relatedTasks.length > 0) {
            const completionRate = relatedTasks.filter(t => t.status === 'completed').length / relatedTasks.length;
            score += completionRate * 0.2;
        }

        return Math.min(1, score);
    }
}

