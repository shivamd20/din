import { useNavigate, useLocation } from 'react-router-dom';
import { PenTool, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { name: 'Capture', path: '/', icon: PenTool },
        { name: 'Timeline', path: '/timeline', icon: Clock },
        { name: 'Reflect', path: '/reflect', icon: Sparkles },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-zinc-100 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.path;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.name}
                            onClick={() => navigate(tab.path)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95",
                                isActive ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 rounded-xl transition-all",
                                isActive && "bg-zinc-100"
                            )}>
                                <Icon
                                    className={cn(
                                        "w-6 h-6",
                                        isActive ? "stroke-[2.5px]" : "stroke-2"
                                    )}
                                />
                            </div>
                            <span className="text-[10px] font-medium tracking-wide">
                                {tab.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
