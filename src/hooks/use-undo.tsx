import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { trpc } from '@/lib/trpc';

interface UndoContextType {
    showUndo: (captureId: string) => void;
    hideUndo: () => void;
    performUndo: () => Promise<void>;
    isShowing: boolean;
    captureId: string | null;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: ReactNode }) {
    const [undoState, setUndoState] = useState<{ captureId: string | null; show: boolean }>({ captureId: null, show: false });
    const revertMutation = trpc.undo.revert.useMutation();
    const timeoutRef = useRef<number | null>(null);

    const showUndo = useCallback((captureId: string) => {
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        setUndoState({ captureId, show: true });
        // Auto-dismiss after 5 seconds
        timeoutRef.current = window.setTimeout(() => {
            setUndoState(prev => ({ ...prev, show: false }));
        }, 5000);
    }, []);

    const hideUndo = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setUndoState({ captureId: null, show: false });
    }, []);

    const performUndo = useCallback(async () => {
        if (!undoState.captureId) return;
        
        try {
            await revertMutation.mutateAsync({ captureId: undoState.captureId });
            hideUndo();
        } catch (error) {
            console.error('Failed to undo:', error);
        }
    }, [undoState.captureId, revertMutation, hideUndo]);

    return (
        <UndoContext.Provider
            value={{
                showUndo,
                hideUndo,
                performUndo,
                isShowing: undoState.show,
                captureId: undoState.captureId,
            }}
        >
            {children}
        </UndoContext.Provider>
    );
}

export function useUndo() {
    const context = useContext(UndoContext);
    if (context === undefined) {
        throw new Error('useUndo must be used within an UndoProvider');
    }
    return context;
}

