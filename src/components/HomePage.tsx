import React, { useState } from 'react';
import { CaptureZone } from './home/CaptureZone';
import { ContextStrip } from './home/ContextStrip';
import { DynamicCardsZone } from './home/DynamicCardsZone';
import { getMicrocopy } from '@/lib/microcopy';

export default function HomePage() {
    const [layoutState, setLayoutState] = useState<'IDLE' | 'CAPTURED'>('IDLE');
    const [confirmationMsg, setConfirmationMsg] = useState("Captured.");

    const handleCapture = () => {
        setLayoutState('CAPTURED');
        setConfirmationMsg(getMicrocopy('CONFIRMATION'));
        setTimeout(() => {
            setLayoutState('IDLE');
        }, 1500);
    };

    return (
        <div className="flex flex-col h-full bg-white relative overflow-y-auto">
            {layoutState === 'CAPTURED' ? (
                <div className="flex flex-col items-center justify-center flex-1 animate-in fade-in zoom-in duration-300 min-h-[50vh]">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4 ring-1 ring-zinc-100 shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 animate-pulse" />
                    </div>
                    <p className="text-lg font-medium text-zinc-600 tracking-tight">{confirmationMsg}</p>
                </div>
            ) : (
                <>
                    {/* 1. Capture Zone (Dominant - First thing when app opens) */}
                    <div className="shrink-0 z-20 bg-white relative pt-6 pb-4">
                        <CaptureZone onCapture={handleCapture} />
                    </div>

                    {/* 2. Context Strip */}
                    <div className="shrink-0 z-30 sticky top-0">
                        <ContextStrip />
                    </div>

                    {/* 3. Feed Cards Zone (Scrollable, limited visible) */}
                    <div className="flex-1 w-full bg-zinc-50/30 pt-6 pb-32 min-h-[60vh] border-t border-zinc-100/50 relative">
                        {/* Subtle gradient fade at top */}
                        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                        <DynamicCardsZone />
                    </div>
                </>
            )}
        </div>
    );
}
