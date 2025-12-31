import React, { useState, useMemo } from 'react';
import { useDynamicCards, type DynamicCardData } from '../../hooks/use-home-data';
import { FocusCard, TodoLiteCard, ReflectionCard, HabitCard, GoalCard } from './DynamicCards';
import { useCapture } from '@/contexts/CaptureContext';
import { RevalidationIndicator } from '../ui/RevalidationIndicator';
import { useActionState } from '@/hooks/use-action-state';

export function DynamicCardsZone() {
    const { data: cards, isRefetching } = useDynamicCards();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const { openCapture } = useCapture();
    const { actionStates, isDismissed } = useActionState();

    // Filter out dismissed cards (both local and persistent)
    const visibleCards = useMemo(() => {
        if (!cards || cards.length === 0) return [];
        return cards.filter(card => {
            const cardId = card.feed_item_id || card.id;
            
            // Don't show if locally dismissed
            if (dismissedIds.has(card.id)) return false;
            
            // Don't show if persistently dismissed (synced and should stay hidden until feed refresh)
            if (isDismissed(cardId)) return false;
            
            // Show cards that are pending/syncing (they'll show visual feedback)
            // Synced cards are already filtered above via isDismissed
            
            return true;
        }).slice(0, 6);
    }, [cards, dismissedIds, isDismissed]);

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

        // Generate action title and metadata (no prefill text - action goes in header)
        let actionTitle: string | undefined;
        let eventType: 'task_start' | 'task_snooze' | 'task_skip' | 'task_finish' | 'commitment_acknowledge' | 'commitment_complete' | 'commitment_cancel' | 'commitment_confirm' | 'clarification_response' | undefined;
        let guidedPrompt = '';

        const content = Array.isArray(card.content) ? card.content[0] : card.content;

        // Handle potential commitment actions
        if (isPotentialCommitment) {
            if (action === 'open_capture') {
                // This is the "Confirm Commitment" action
                actionTitle = 'Confirm Commitment';
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
                    actionTitle = 'Start Task';
                    eventType = 'task_start';
                    guidedPrompt = 'What are you focusing on for this task?';
                    break;
                case 'snooze':
                    actionTitle = 'Snooze Task';
                    eventType = 'task_snooze';
                    guidedPrompt = 'When should this be rescheduled?';
                    break;
                case 'skip':
                    actionTitle = 'Skip Task';
                    eventType = 'task_skip';
                    guidedPrompt = 'Why are you skipping this?';
                    break;
                case 'done':
                    actionTitle = 'Mark as Done';
                    eventType = 'task_finish';
                    guidedPrompt = 'What did you accomplish?';
                    break;
                case 'open_capture':
                    actionTitle = 'Add Note';
                    guidedPrompt = generationReason ? `About: ${generationReason}` : 'What\'s on your mind?';
                    break;
                default:
                    actionTitle = 'Capture';
                    guidedPrompt = generationReason ? `Context: ${generationReason}` : '';
            }
        }

        // Build comprehensive action context for LLM
        const actionContext: Record<string, unknown> = {
            // Action information
            action_taken: action,
            action_title: actionTitle,
            
            // Feed item information
            feed_item_id: feedItemId,
            card_content: content,
            card_type: card.type,
            card_title: card.title,
            
            // Related entities
            related_task_id: relatedTaskId || null,
            related_commitment_id: relatedCommitmentId || null,
            
            // Generation context
            ...(generationReason && { generation_reason: generationReason }),
            ...((card as any).priority_score && { priority_score: (card as any).priority_score }),
            ...((card as any).expires_at && { expires_at: (card as any).expires_at }),
            
            // User guidance
            guided_prompt: guidedPrompt,
            
            // Include potential commitment metadata for LLM parsing
            ...(isPotentialCommitment && {
                is_potential_commitment: true,
                detected_strength: metadata.detected_strength,
                detected_horizon: metadata.detected_horizon,
                time_horizon_type: metadata.time_horizon_type,
                time_horizon_value: metadata.time_horizon_value,
                cadence_days: metadata.cadence_days,
                check_in_method: metadata.check_in_method,
                consequence_level: metadata.consequence_level
            })
        };

        // Open capture box with action title in header, empty textarea, and comprehensive metadata
        openCapture('', {
            event_type: eventType,
            linked_task_id: relatedTaskId || undefined,
            linked_commitment_id: relatedCommitmentId || undefined,
            feed_item_id: feedItemId,
            action_type: action,
            action_context: actionContext
        }, actionTitle);

        // Dismiss card for certain actions (including commitment confirmation)
        if (action === 'done' || action === 'snooze' || action === 'skip' || eventType === 'commitment_confirm') {
            handleDismiss(card.id);
        }
    };

    return (
        <div className="w-full px-4 mb-20 space-y-3">
            {/* Revalidation Indicator */}
            <div className="flex justify-end mb-2">
                <RevalidationIndicator isRefetching={isRefetching} />
            </div>

            {visibleCards.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">
                    No feed items available. Create a capture to generate your feed.
                </div>
            ) : (
                <>
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
                </>
            )}
        </div>
    );
}
