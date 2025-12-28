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
        <div className="w-full py-1.5 px-4 flex items-center justify-between border-b border-zinc-50/50 bg-white/30 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-[10px] font-medium tracking-wide opacity-60">{timeString}</span>
            </div>

            <div className="flex items-center gap-1.5">
                <span className={`flex items-center justify-center w-5 h-5 rounded-full bg-zinc-50/50 text-zinc-400`}>
                    {getIcon()}
                </span>
                <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[11px] font-medium text-zinc-400">{data.label}</span>
                    {data.sublabel && <span className="text-[9px] text-zinc-300 font-medium tracking-wide opacity-70">{data.sublabel}</span>}
                </div>
            </div>
        </div>
    );
}
