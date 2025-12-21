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
                    {/* 1. Capture Zone (Dominant) */}
                    <div className="shrink-0 z-20 bg-white relative pt-4">
                        <CaptureZone onCapture={handleCapture} />
                    </div>

                    {/* 2. Context Strip */}
                    <div className="shrink-0 z-30 sticky top-0">
                        <ContextStrip />
                    </div>

                    {/* 3. Dynamic Cards Zone (Scrollable content below) */}
                    {/* bg-[#F5F5F7] is the Apple System Gray 6 (light mode background) */}
                    <div className="flex-1 w-full bg-[#FAFAFA] pt-8 pb-32 min-h-[80vh] border-t border-zinc-50 relative">
                        {/* Decorative gradient fade at top of list */}
                        <div className="absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-black/[0.02] to-transparent pointer-events-none" />
                        <DynamicCardsZone />
                    </div>
                </>
            )}
        </div>
    );
}
