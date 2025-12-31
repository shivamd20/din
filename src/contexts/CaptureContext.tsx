import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface CaptureMetadata {
    event_type?: 'task_start' | 'task_snooze' | 'task_skip' | 'task_finish' | 'commitment_acknowledge' | 'commitment_complete' | 'commitment_cancel' | 'commitment_confirm' | 'clarification_response';
    linked_task_id?: string;
    linked_commitment_id?: string;
    event_payload?: Record<string, unknown>;
    feed_item_id?: string | null;
    action_type?: string | null;
    action_context?: Record<string, unknown>;
}

interface CaptureContextType {
    isOpen: boolean;
    prefillText: string;
    actionTitle?: string; // Action description for header
    metadata: CaptureMetadata | undefined;
    openCapture: (prefill?: string, metadata?: CaptureMetadata, actionTitle?: string) => void;
    closeCapture: () => void;
}

const CaptureContext = createContext<CaptureContextType | undefined>(undefined);

export function CaptureProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [prefillText, setPrefillText] = useState('');
    const [actionTitle, setActionTitle] = useState<string | undefined>(undefined);
    const [metadata, setMetadata] = useState<CaptureMetadata | undefined>(undefined);

    const openCapture = useCallback((prefill = '', meta?: CaptureMetadata, title?: string) => {
        setPrefillText(prefill);
        setMetadata(meta);
        setActionTitle(title);
        setIsOpen(true);
    }, []);

    const closeCapture = useCallback(() => {
        setIsOpen(false);
        setPrefillText('');
        setActionTitle(undefined);
        setMetadata(undefined);
    }, []);

    return (
        <CaptureContext.Provider
            value={{
                isOpen,
                prefillText,
                actionTitle,
                metadata,
                openCapture,
                closeCapture,
            }}
        >
            {children}
        </CaptureContext.Provider>
    );
}

export function useCapture() {
    const context = useContext(CaptureContext);
    if (context === undefined) {
        throw new Error('useCapture must be used within a CaptureProvider');
    }
    return context;
}

