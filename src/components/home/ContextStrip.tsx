import React from 'react';
import { useContextStrip } from '../../hooks/use-home-data';
import { Moon, Sun, Briefcase, Dumbbell, Sparkles } from 'lucide-react';

export function ContextStrip() {
    const { data } = useContextStrip();

    const getIcon = () => {
        switch (data.type) {
            case 'work': return <Briefcase className="w-3.5 h-3.5" />;
            case 'workout': return <Dumbbell className="w-3.5 h-3.5" />;
            case 'wind-down': return <Moon className="w-3.5 h-3.5" />;
            default: return <Sun className="w-3.5 h-3.5" />;
        }
    };

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="w-full py-3 px-6 flex items-center justify-between border-b border-zinc-100 bg-white/50 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-[11px] font-semibold tracking-wider uppercase opacity-80">{timeString}</span>
            </div>

            <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-6 h-6 rounded-full bg-zinc-50 text-zinc-900`}>
                    {getIcon()}
                </span>
                <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[13px] font-medium text-zinc-700">{data.label}</span>
                    {data.sublabel && <span className="text-[10px] text-zinc-400 font-medium tracking-wide">{data.sublabel}</span>}
                </div>
            </div>
        </div>
    );
}
