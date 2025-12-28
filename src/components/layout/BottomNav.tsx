import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageSquare, CheckSquare2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { name: 'Feed', path: '/', icon: Home },
        { name: 'Chat', path: '/chat', icon: MessageSquare },
        { name: 'Tasks', path: '/tasks', icon: CheckSquare2 },
        { name: 'Commitments', path: '/commitments', icon: Target },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-zinc-100/80 shadow-[0_-2px_20px_-8px_rgba(0,0,0,0.08)] pb-safe">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.path || (tab.path === '/' && location.pathname === '/');
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.name}
                            onClick={() => navigate(tab.path)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-all duration-200 active:scale-95",
                                isActive ? "text-zinc-900" : "text-zinc-400"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-xl transition-all duration-200",
                                isActive && "bg-zinc-100/80"
                            )}>
                                <Icon
                                    className={cn(
                                        "w-5 h-5 transition-all",
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
