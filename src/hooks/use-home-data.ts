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
 */
function mapFeedItemToCard(item: {
    id: string;
    phrasing: string;
    supporting_note?: string;
    suggested_actions: Array<{ action: string; label: string }>;
}): DynamicCardData {
    // Determine card type from feed item (we'll infer from phrasing or use a default)
    // For now, we'll use a simple heuristic or default to 'focus'
    let cardType: DynamicCardData['type'] = 'focus';
    
    // Try to infer from phrasing
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

    // Map actions
    const actions: CardAction[] = item.suggested_actions.map(sa => ({
        label: sa.label,
        action: sa.action as CardAction['action'],
        variant: sa.action === 'start' || sa.action === 'done' ? 'primary' : 'secondary'
    }));

    // Determine content format
    // If phrasing contains multiple items (like a todo list), split it
    const content: string | string[] = item.phrasing;

    return {
        id: item.id,
        type: cardType,
        title: cardType === 'todo' ? 'Tasks' : cardType === 'goal' ? 'Commitment' : cardType === 'habit' ? 'Habit' : cardType === 'reflection' ? 'Reflection' : 'Focus',
        content,
        actions
    };
}

export function useDynamicCards() {
    const { data: feedItems, isLoading, error } = trpc.feed.getCurrent.useQuery();

    const cards = React.useMemo(() => {
        if (isLoading) {
            return [];
        }

        if (error || !feedItems || (Array.isArray(feedItems) && feedItems.length === 0)) {
            // Return empty array if no feed items
            return [];
        }

        // Map feed items to cards
        return feedItems.map(mapFeedItemToCard);
    }, [feedItems, isLoading, error]);

    return { data: cards, isLoading };
}
