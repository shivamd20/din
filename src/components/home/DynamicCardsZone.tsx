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

    const handleAction = (action: string, card: DynamicCardData & {
        feed_item_id?: string;
        related_task_id?: string | null;
        related_commitment_id?: string | null;
        generation_reason?: string;
        metadata?: Record<string, unknown>;
    }) => {
        // Extract metadata from card
        const feedItemId = card.feed_item_id || card.id;
        const relatedTaskId = card.related_task_id;
        const relatedCommitmentId = card.related_commitment_id;
        const generationReason = card.generation_reason;
        const metadata = card.metadata || {};
        const isPotentialCommitment = metadata.is_potential_commitment === true;

        // Generate smart prefill text based on action and card context
        let prefillText = '';
        let eventType: 'task_start' | 'task_snooze' | 'task_skip' | 'task_finish' | 'commitment_acknowledge' | 'commitment_complete' | 'commitment_cancel' | 'commitment_confirm' | 'clarification_response' | undefined;
        let guidedPrompt = '';

        const content = Array.isArray(card.content) ? card.content[0] : card.content;

        // Handle potential commitment actions
        if (isPotentialCommitment) {
            if (action === 'open_capture') {
                // This is the "Confirm Commitment" action
                prefillText = `Confirming commitment: ${content}`;
                eventType = 'commitment_confirm';
                guidedPrompt = 'Add any details about this commitment (time horizon, check-in method, etc.)';
            } else if (action === 'dismiss' || action === 'skip') {
                // This is the "Not a Commitment" action - soft dismiss
                handleDismiss(card.id);
                return; // Don't open capture box for dismissal
            }
        }

        // Handle regular actions if not a potential commitment action
        if (!eventType && !isPotentialCommitment) {
            switch (action) {
                case 'start':
                    prefillText = `Started working on ${content}`;
                    eventType = 'task_start';
                    guidedPrompt = 'What are you focusing on for this task?';
                    break;
                case 'snooze':
                    prefillText = `Snoozing ${content}. Snooze until?`;
                    eventType = 'task_snooze';
                    guidedPrompt = 'When should this be rescheduled?';
                    break;
                case 'skip':
                    prefillText = `Skipping ${content}`;
                    eventType = 'task_skip';
                    guidedPrompt = 'Why are you skipping this?';
                    break;
                case 'done':
                    prefillText = `Finished ${content}`;
                    eventType = 'task_finish';
                    guidedPrompt = 'What did you accomplish?';
                    break;
                case 'open_capture':
                    prefillText = '';
                    guidedPrompt = generationReason ? `About: ${generationReason}` : 'What\'s on your mind?';
                    break;
                default:
                    prefillText = content;
                    guidedPrompt = generationReason ? `Context: ${generationReason}` : '';
            }
        }

        // Build action context with guided prompt and potential commitment metadata
        const actionContext: Record<string, unknown> = {
            guided_prompt: guidedPrompt,
            card_content: content,
            ...(generationReason && { generation_reason: generationReason }),
            // Include potential commitment metadata for LLM parsing
            ...(isPotentialCommitment && {
                detected_strength: metadata.detected_strength,
                detected_horizon: metadata.detected_horizon,
                time_horizon_type: metadata.time_horizon_type,
                time_horizon_value: metadata.time_horizon_value,
                cadence_days: metadata.cadence_days,
                check_in_method: metadata.check_in_method,
                consequence_level: metadata.consequence_level
            })
        };

        // Open capture box with prefill and metadata
        openCapture(prefillText, {
            event_type: eventType,
            linked_task_id: relatedTaskId || undefined,
            linked_commitment_id: relatedCommitmentId || undefined,
            feed_item_id: feedItemId,
            action_type: action,
            action_context: actionContext
        });

        // Dismiss card for certain actions (including commitment confirmation)
        if (action === 'done' || action === 'snooze' || action === 'skip' || eventType === 'commitment_confirm') {
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
                    case 'focus': return <FocusCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} />;
                    case 'todo': return <TodoLiteCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} />;
                    case 'reflection': return <ReflectionCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} />;
                    case 'habit': return <HabitCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} />;
                    case 'goal': return <GoalCard key={card.id} data={card} onAction={(action) => handleAction(action, card)} />;
                    default: return null;
                }
            })}
        </div>
    );
}
