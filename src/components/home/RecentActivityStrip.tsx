import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, Cloud, ChevronRight } from 'lucide-react';
import type { Entry } from '@/lib/db';

interface RecentActivityStripProps {
    entries: Entry[];
    count: number;
    latestEntry: Entry | null;
    hasUnsynced: boolean;
    onHideChange?: (hidden: boolean) => void;
}

const AUTO_HIDE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export function RecentActivityStrip({ entries, count, latestEntry, hasUnsynced, onHideChange }: RecentActivityStripProps) {
    const navigate = useNavigate();
    const [firstCaptureTime, setFirstCaptureTime] = useState<number | null>(null);
    const [shouldHide, setShouldHide] = useState(false);

    // Track when the first recent capture appeared
    useEffect(() => {
        if (count > 0 && firstCaptureTime === null) {
            setFirstCaptureTime(Date.now());
            setShouldHide(false);
        } else if (count === 0) {
            // Reset if no recent entries
            setFirstCaptureTime(null);
            setShouldHide(false);
        }
    }, [count, firstCaptureTime]);

    // Auto-hide after 10 minutes, but only if all items are synced
    useEffect(() => {
        if (firstCaptureTime === null) return;

        const checkHide = () => {
            const elapsed = Date.now() - firstCaptureTime;
            // Only hide if 10 minutes have passed AND all items are synced
            if (elapsed >= AUTO_HIDE_DURATION_MS && !hasUnsynced) {
                setShouldHide(true);
            } else {
                setShouldHide(false);
            }
        };

        const interval = setInterval(checkHide, 1000); // Check every second
        checkHide(); // Check immediately

        return () => clearInterval(interval);
    }, [firstCaptureTime, hasUnsynced]);

    // Notify parent of hide state changes
    useEffect(() => {
        if (onHideChange) {
            onHideChange(shouldHide);
        }
    }, [shouldHide, onHideChange]);

    // Determine sync status icon - refined and premium
    const getSyncIcon = () => {
        if (!navigator.onLine) {
            return (
                <div 
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 shadow-sm"
                    aria-hidden="true"
                >
                    <Cloud className="w-4 h-4 text-amber-600" strokeWidth={2} />
                </div>
            );
        }
        if (hasUnsynced) {
            return (
                <div 
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 shadow-sm"
                    aria-hidden="true"
                >
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" strokeWidth={2} />
                </div>
            );
        }
        return (
            <div 
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-500/10 backdrop-blur-sm border border-green-500/20 shadow-sm"
                aria-hidden="true"
            >
                <Check className="w-4 h-4 text-green-600" strokeWidth={2} />
            </div>
        );
    };

    // Get display text - refined typography
    const getDisplayText = () => {
        if (count > 1) {
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                        {count} recent captures
                    </span>
                    {latestEntry && (
                        <span className="text-[11px] text-zinc-500 truncate leading-tight">
                            {latestEntry.text.trim().substring(0, 45)}{latestEntry.text.trim().length > 45 ? '...' : ''}
                        </span>
                    )}
                </div>
            );
        }
        if (latestEntry) {
            const text = latestEntry.text.trim();
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                        Recent capture
                    </span>
                    <span className="text-[11px] text-zinc-600 truncate leading-tight">
                        {text.length > 55 ? text.substring(0, 55) + '...' : text}
                    </span>
                </div>
            );
        }
        return (
            <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                Recent capture
            </span>
        );
    };

    const handleTap = () => {
        navigate('/timeline');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTap();
        }
    };

    // Don't render if count is 0 (shouldn't happen due to HomePage check, but safety)
    if (count === 0) {
        return null;
    }

    // Don't render if should hide (let HomePage show ContextStrip instead)
    if (shouldHide) {
        return null;
    }

    // Get accessible label based on state
    const getAriaLabel = () => {
        if (count > 1) {
            return `View ${count} recent captures in timeline${hasUnsynced ? '. Syncing in progress' : '. All synced'}`;
        }
        return `View recent capture in timeline${hasUnsynced ? '. Syncing in progress' : '. Synced'}`;
    };

    return (
        <button
            onClick={handleTap}
            onKeyDown={handleKeyDown}
            className="group w-full py-2 px-4 flex items-center gap-3 border-b border-zinc-100/60 bg-white/40 backdrop-blur-xl sticky top-0 z-30 hover:bg-white/60 focus:bg-white/60 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:ring-offset-0 transition-all duration-200 active:scale-[0.99] shadow-[0_1px_3px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-top-2 duration-300"
            aria-label={getAriaLabel()}
            role="button"
            tabIndex={0}
        >
            {/* Sync Status Icon - Refined */}
            <div className="flex-shrink-0">
                {getSyncIcon()}
            </div>

            {/* Text Content - Premium typography */}
            <div className="flex-1 min-w-0 text-left">
                {getDisplayText()}
            </div>

            {/* Chevron Indicator - Refined */}
            <ChevronRight 
                className="w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" 
                strokeWidth={2}
                aria-hidden="true"
            />
        </button>
    );
}

