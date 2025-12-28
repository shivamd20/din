import React, { useState, useMemo } from 'react';
import { useDynamicCards, type DynamicCardData } from '../../hooks/use-home-data';
import { FocusCard, TodoLiteCard, ReflectionCard, HabitCard, GoalCard } from './DynamicCards';
import { useCapture } from '@/contexts/CaptureContext';

export function DynamicCardsZone() {
    const { data: cards, isLoading } = useDynamicCards();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const { openCapture } = useCapture();

    // Filter out dismissed cards
    const visibleCards = useMemo(() => {
        if (!cards || cards.length === 0) return [];
        return cards.filter(card => !dismissedIds.has(card.id)).slice(0, 6);
    }, [cards, dismissedIds]);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => new Set([...prev, id]));
    };

    const handleAction = (action: string, card: DynamicCardData) => {
        // Generate prefill text based on action and card content
        let prefillText = '';
        let eventType: 'task_start' | 'task_snooze' | 'task_skip' | 'task_finish' | undefined;
        let linkedTaskId: string | undefined;
        let linkedCommitmentId: string | undefined;

        const content = Array.isArray(card.content) ? card.content[0] : card.content;

        switch (action) {
            case 'start':
                prefillText = `Started working on ${content}`;
                eventType = 'task_start';
                // Extract task/commitment ID from card if available (would need to be passed in card data)
                break;
            case 'snooze':
                prefillText = `Snoozing ${content}. Snooze until?`;
                eventType = 'task_snooze';
                break;
            case 'skip':
                prefillText = `Skipping ${content}`;
                eventType = 'task_skip';
                break;
            case 'done':
                prefillText = `Finished ${content}`;
                eventType = 'task_finish';
                break;
            case 'open_capture':
                prefillText = '';
                break;
            default:
                prefillText = content;
        }

        // Open capture box with prefill
        openCapture(prefillText, eventType ? {
            event_type: eventType,
            linked_task_id: linkedTaskId,
            linked_commitment_id: linkedCommitmentId,
        } : undefined);

        // Dismiss card for certain actions
        if (action === 'done' || action === 'snooze' || action === 'skip') {
            handleDismiss(card.id);
        }
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
                    case 'focus': return <FocusCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} onDismiss={handleDismiss} />;
                    case 'todo': return <TodoLiteCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} onDismiss={handleDismiss} />;
                    case 'reflection': return <ReflectionCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} onDismiss={handleDismiss} />;
                    case 'habit': return <HabitCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} onDismiss={handleDismiss} />;
                    case 'goal': return <GoalCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} onDismiss={handleDismiss} />;
                    default: return null;
                }
            })}
        </div>
    );
}
