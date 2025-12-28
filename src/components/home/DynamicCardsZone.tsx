import React, { useState, useMemo } from 'react';
import { useDynamicCards, type DynamicCardData } from '../../hooks/use-home-data';
import { FocusCard, TodoLiteCard, ReflectionCard, HabitCard, GoalCard } from './DynamicCards';

export function DynamicCardsZone() {
    const { data: cards, isLoading } = useDynamicCards();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Filter out dismissed cards
    const visibleCards = useMemo(() => {
        if (!cards || cards.length === 0) return [];
        return cards.filter(card => !dismissedIds.has(card.id)).slice(0, 3);
    }, [cards, dismissedIds]);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => new Set([...prev, id]));
    };

    const handleAction = (action: string, id: string) => {
        console.log(`Action ${action} on card ${id}`);
        if (action === 'done' || action === 'snooze' || action === 'skip') {
            handleDismiss(id);
        }
        // 'open_capture' would likely need to bubble up or use a context to focus the input
    };

    if (isLoading) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">
                Loading feed...
            </div>
        );
    }

    if (visibleCards.length === 0) {
        return (
            <div className="text-center py-8 text-zinc-400 text-sm">
                No feed items available. Create a capture to generate your feed.
            </div>
        );
    }

    return (
        <div className="w-full px-4 mb-20 space-y-3">
            {/* Helper title strictly optional/minimal */}
            {/* <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-2">Suggestions</h2> */}

            {visibleCards.map(card => {
                switch (card.type) {
                    case 'focus': return <FocusCard key={card.id} data={card} onAction={handleAction} onDismiss={handleDismiss} />;
                    case 'todo': return <TodoLiteCard key={card.id} data={card} onAction={handleAction} onDismiss={handleDismiss} />;
                    case 'reflection': return <ReflectionCard key={card.id} data={card} onAction={handleAction} onDismiss={handleDismiss} />;
                    case 'habit': return <HabitCard key={card.id} data={card} onAction={handleAction} onDismiss={handleDismiss} />;
                    case 'goal': return <GoalCard key={card.id} data={card} onAction={handleAction} onDismiss={handleDismiss} />;
                    default: return null;
                }
            })}
        </div>
    );
}
