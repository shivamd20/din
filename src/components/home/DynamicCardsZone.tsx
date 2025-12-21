import React, { useState } from 'react';
import { useDynamicCards, type DynamicCardData } from '../../hooks/use-home-data';
import { FocusCard, TodoLiteCard, ReflectionCard, HabitCard, GoalCard } from './DynamicCards';

export function DynamicCardsZone() {
    const { data: initialCards } = useDynamicCards();
    const [cards, setCards] = useState(initialCards);

    const handleDismiss = (id: string) => {
        // Animate out (handled by parent re-render or animation library if we had one, for now just state filter)
        setCards(prev => prev.filter(c => c.id !== id));
    };

    const handleAction = (action: string, id: string) => {
        console.log(`Action ${action} on card ${id}`);
        if (action === 'done' || action === 'snooze' || action === 'skip') {
            handleDismiss(id);
        }
        // 'open_capture' would likely need to bubble up or use a context to focus the input
    };

    if (cards.length === 0) return null;

    // Max 3 cards
    const visibleCards = cards.slice(0, 3);

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
