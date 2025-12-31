import React from 'react';
import { trpc } from '../lib/trpc';

export interface ContextStripData {
    label: string;
    sublabel: string;
    type: 'work' | 'personal' | 'wind-down' | 'workout';
}

export interface CardAction {
    label: string;
    action: 'start' | 'snooze' | 'skip' | 'done' | 'remind' | 'open_capture';
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface DynamicCardData {
    id: string;
    type: 'focus' | 'todo' | 'reflection' | 'habit' | 'goal';
    title: string;
    content: string | string[]; // string for simple text, array for TODOs
    actions: CardAction[];
}

export function useContextStrip() {
    // Mock logic based on time of day
    const hour = new Date().getHours();

    let data: ContextStripData = {
        label: 'Deep work day',
        sublabel: 'Low interruptions',
        type: 'work'
    };

    if (hour < 9) {
        data = { label: 'Morning routine', sublabel: 'Set the tone', type: 'personal' };
    } else if (hour >= 17 && hour < 20) {
        data = { label: 'Workout window', sublabel: '45 mins', type: 'workout' };
    } else if (hour >= 20) {
        data = { label: 'Evening wind-down', sublabel: 'Disconnect', type: 'wind-down' };
    }

    return { data };
}

/**
 * Map FeedItemRendered to DynamicCardData
 * Preserves all metadata for use in action handlers and UI display
 */
function mapFeedItemToCard(item: {
    id: string;
    phrasing: string;
    supporting_note?: string;
    suggested_actions: Array<{ action: string; label: string }>;
    generation_reason?: string;
    related_task_id?: string | null;
    related_commitment_id?: string | null;
    related_signal_ids?: string[];
    source_entry_ids?: string[];
    priority_score?: number;
    expires_at?: number | null;
    metadata?: any;
    type?: string;
}): DynamicCardData & {
    feed_item_id: string;
    related_task_id?: string | null;
    related_commitment_id?: string | null;
    generation_reason?: string;
    priority_score?: number;
    expires_at?: number | null;
    metadata?: any;
} {
    // Determine card type from feed item type or infer from phrasing
    let cardType: DynamicCardData['type'] = 'focus';
    
    if (item.type) {
        // Map feed item types to card types
        const typeMap: Record<string, DynamicCardData['type']> = {
            'task': 'todo',
            'immediate_action': 'focus',
            'prep_task': 'todo',
            'blocker': 'focus',
            'commitment_reminder': 'goal',
            'potential_commitment': 'goal', // Map potential_commitment to goal type
            'habit': 'habit',
            'reflection': 'reflection',
            'data_collection': 'focus'
        };
        cardType = typeMap[item.type] || 'focus';
    } else {
        // Fallback: Try to infer from phrasing
        const phrasingLower = item.phrasing.toLowerCase();
        if (phrasingLower.includes('task') || phrasingLower.includes('todo')) {
            cardType = 'todo';
        } else if (phrasingLower.includes('commitment') || phrasingLower.includes('committed')) {
            cardType = 'goal';
        } else if (phrasingLower.includes('habit')) {
            cardType = 'habit';
        } else if (phrasingLower.includes('reflection') || phrasingLower.includes('thinking')) {
            cardType = 'reflection';
        }
    }

    // Map actions - handle potential commitment actions specially
    const actions: CardAction[] = item.suggested_actions.map(sa => {
        // Map "confirm" action for potential commitments
        const action = sa.action === 'confirm' ? 'open_capture' : sa.action as CardAction['action'];
        const variant = sa.action === 'confirm' ? 'primary' : 
                       sa.action === 'start' || sa.action === 'done' ? 'primary' : 
                       'secondary';
        return {
            label: sa.label,
            action,
            variant
        };
    });

    // Determine content format
    const content: string | string[] = item.phrasing;

    // Check if this is a potential commitment
    const isPotentialCommitment = item.type === 'potential_commitment';
    
    return {
        id: item.id,
        type: cardType,
        title: cardType === 'todo' ? 'Tasks' : cardType === 'goal' ? (isPotentialCommitment ? 'Potential Commitment' : 'Commitment') : cardType === 'habit' ? 'Habit' : cardType === 'reflection' ? 'Reflection' : 'Focus',
        content,
        actions,
        // Preserve all metadata including potential commitment metadata
        feed_item_id: item.id,
        related_task_id: item.related_task_id,
        related_commitment_id: item.related_commitment_id,
        generation_reason: item.generation_reason,
        priority_score: item.priority_score,
        expires_at: item.expires_at,
        metadata: {
            ...item.metadata,
            // Add flag to indicate this is a potential commitment
            is_potential_commitment: isPotentialCommitment,
            // Include potential commitment specific metadata
            ...(isPotentialCommitment && item.metadata && {
                detected_strength: item.metadata.detected_strength,
                detected_horizon: item.metadata.detected_horizon,
                time_horizon_type: item.metadata.time_horizon_type,
                time_horizon_value: item.metadata.time_horizon_value,
                cadence_days: item.metadata.cadence_days,
                check_in_method: item.metadata.check_in_method
            })
        }
    };
}

export function useDynamicCards() {
    const { data: feedItems, isRefetching, error } = trpc.feed.getCurrent.useQuery();

    // Emit feed refresh event when feed data changes (new feed generated)
    // This clears dismissed cards since the new feed won't have acted-upon cards
    React.useEffect(() => {
        if (feedItems && feedItems.length > 0) {
            const feedRefreshEvent = new CustomEvent('feed:refreshed');
            window.dispatchEvent(feedRefreshEvent);
        }
    }, [feedItems]); // Only when feedItems change (new feed generated)

    const cards = React.useMemo(() => {
        // Use stale data if available, even if refetching
        if (!feedItems || (Array.isArray(feedItems) && feedItems.length === 0)) {
            // Return empty array if no feed items
            return [];
        }

        // Map feed items to cards
        return feedItems.map(mapFeedItemToCard);
    }, [feedItems, error]);

    return { data: cards, isRefetching };
}
