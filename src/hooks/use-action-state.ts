import { useState, useEffect, useCallback } from 'react';

export interface ActionState {
    entryId: string;
    cardId: string;
    status: 'pending' | 'syncing' | 'synced' | 'error';
    actionType: string;
    timestamp: number;
}

const STORAGE_KEY = 'din-action-states';
const MAPPING_KEY = 'din-entry-card-mapping';
const DISMISSED_CARDS_KEY = 'din-dismissed-cards';

// Load entryId -> cardId mapping
function loadEntryCardMapping(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
        const stored = localStorage.getItem(MAPPING_KEY);
        if (!stored) return {};
        return JSON.parse(stored);
    } catch {
        return {};
    }
}

// Save entryId -> cardId mapping
function saveEntryCardMapping(mapping: Record<string, string>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
    } catch (error) {
        console.error('Failed to persist entry-card mapping', error);
    }
}

// Load dismissed cards from localStorage
function loadDismissedCards(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const stored = localStorage.getItem(DISMISSED_CARDS_KEY);
        if (!stored) return new Set();
        const cards = JSON.parse(stored) as string[];
        // Filter out old cards (older than 24 hours) - they should be gone from feed by then
        return new Set(cards);
    } catch {
        return new Set();
    }
}

// Save dismissed cards to localStorage
function saveDismissedCards(cards: Set<string>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DISMISSED_CARDS_KEY, JSON.stringify(Array.from(cards)));
    } catch (error) {
        console.error('Failed to persist dismissed cards', error);
    }
}

// Load persisted states from localStorage
function loadPersistedStates(): Record<string, ActionState> {
    if (typeof window === 'undefined') return {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        const states = JSON.parse(stored) as Record<string, ActionState>;
        // Filter out old states (older than 24 hours)
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        return Object.fromEntries(
            Object.entries(states).filter(([, state]) => {
                return now - state.timestamp < dayMs;
            })
        ) as Record<string, ActionState>;
    } catch {
        return {};
    }
}

// Save states to localStorage
function savePersistedStates(states: Record<string, ActionState>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (error) {
        console.error('Failed to persist action states', error);
    }
}

export function useActionState() {
    const [actionStates, setActionStates] = useState<Record<string, ActionState>>(() => loadPersistedStates());
    const [entryCardMapping, setEntryCardMapping] = useState<Record<string, string>>(() => loadEntryCardMapping());
    const [dismissedCards, setDismissedCards] = useState<Set<string>>(() => loadDismissedCards());

    // Persist states when they change
    useEffect(() => {
        savePersistedStates(actionStates);
    }, [actionStates]);

    // Persist mapping when it changes
    useEffect(() => {
        saveEntryCardMapping(entryCardMapping);
    }, [entryCardMapping]);

    // Persist dismissed cards when they change
    useEffect(() => {
        saveDismissedCards(dismissedCards);
    }, [dismissedCards]);

    // Listen for action taken events
    useEffect(() => {
        const handleActionTaken = (event: CustomEvent) => {
            const { entryId, cardId, actionType, timestamp } = event.detail;
            
            // Store mapping
            setEntryCardMapping(prev => ({
                ...prev,
                [entryId]: cardId
            }));
            
            // Store action state
            setActionStates(prev => ({
                ...prev,
                [cardId]: {
                    entryId,
                    cardId,
                    status: 'pending',
                    actionType,
                    timestamp,
                }
            }));
        };

        // Listen for sync events
        const handleSyncStart = (event: CustomEvent) => {
            const { entryId } = event.detail;
            setActionStates(prev => {
                const updated = { ...prev };
                // Find card by entryId using mapping or direct lookup
                const cardId = entryCardMapping[entryId] || Object.keys(prev).find(cid => prev[cid].entryId === entryId);
                if (cardId && prev[cardId]) {
                    updated[cardId] = { ...prev[cardId], status: 'syncing' };
                }
                return updated;
            });
        };

        const handleSyncComplete = (event: CustomEvent) => {
            const { entryId } = event.detail;
            setActionStates(prev => {
                const updated = { ...prev };
                // Find card by entryId using mapping or direct lookup
                const cardId = entryCardMapping[entryId] || Object.keys(prev).find(cid => prev[cid].entryId === entryId);
                if (cardId && prev[cardId]) {
                    updated[cardId] = { ...prev[cardId], status: 'synced' };
                    
                    // Mark card as dismissed - it should stay hidden until feed refreshes
                    setDismissedCards(prev => new Set([...prev, cardId]));
                    
                    // Remove action state after fade animation completes (500ms) + buffer
                    setTimeout(() => {
                        setActionStates(current => {
                            const next = { ...current };
                            delete next[cardId];
                            return next;
                        });
                        // Clean up mapping
                        setEntryCardMapping(current => {
                            const next = { ...current };
                            delete next[entryId];
                            return next;
                        });
                    }, 600); // 400ms animation + 200ms buffer
                }
                return updated;
            });
        };

        const handleSyncError = (event: CustomEvent) => {
            const { entryId } = event.detail;
            setActionStates(prev => {
                const updated = { ...prev };
                // Find card by entryId using mapping or direct lookup
                const cardId = entryCardMapping[entryId] || Object.keys(prev).find(cid => prev[cid].entryId === entryId);
                if (cardId && prev[cardId]) {
                    // Keep as pending, will retry
                    updated[cardId] = { ...prev[cardId], status: 'pending' };
                }
                return updated;
            });
        };

        window.addEventListener('action:taken', handleActionTaken as EventListener);
        window.addEventListener('sync:start', handleSyncStart as EventListener);
        window.addEventListener('sync:complete', handleSyncComplete as EventListener);
        window.addEventListener('sync:error', handleSyncError as EventListener);

        return () => {
            window.removeEventListener('action:taken', handleActionTaken as EventListener);
            window.removeEventListener('sync:start', handleSyncStart as EventListener);
            window.removeEventListener('sync:complete', handleSyncComplete as EventListener);
            window.removeEventListener('sync:error', handleSyncError as EventListener);
        };
    }, [entryCardMapping]);

    const getActionState = useCallback((cardId: string): ActionState | undefined => {
        return actionStates[cardId];
    }, [actionStates]);

    const isDismissed = useCallback((cardId: string): boolean => {
        return dismissedCards.has(cardId);
    }, [dismissedCards]);

    // Listen for feed refresh to clear dismissed cards
    useEffect(() => {
        const handleFeedRefresh = () => {
            // Clear dismissed cards when feed refreshes - new feed won't have these cards
            setDismissedCards(new Set());
        };

        // Listen for feed refresh events (from Header refresh button or automatic refresh)
        window.addEventListener('feed:refreshed', handleFeedRefresh);

        return () => {
            window.removeEventListener('feed:refreshed', handleFeedRefresh);
        };
    }, []);

    return {
        actionStates,
        getActionState,
        dismissedCards,
        isDismissed,
    };
}

