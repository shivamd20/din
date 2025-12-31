import { useNavigate } from 'react-router-dom';
import { UserCircle, RefreshCcw, LogOut, Menu, Clock, RotateCw } from 'lucide-react';
import { type Session, signOut, signIn } from '@/lib/auth-client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/db';
import { trpc, queryClient } from '@/lib/trpc';
import { useState } from 'react';

interface HeaderProps {
    user: Session['user'];
}

export function Header({ user }: HeaderProps) {
    const navigate = useNavigate();
    const utils = trpc.useUtils();
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const refreshFeedMutation = trpc.feed.refresh.useMutation({
        onSuccess: () => {
            // Invalidate and refetch feed data
            utils.feed.getCurrent.invalidate();
            setIsRefreshing(false);
            
            // Emit feed refresh event to clear dismissed cards
            const feedRefreshEvent = new CustomEvent('feed:refreshed');
            window.dispatchEvent(feedRefreshEvent);
        },
        onError: (error) => {
            console.error('Failed to refresh feed:', error);
            setIsRefreshing(false);
        },
    });

    const handleRefreshFeed = async () => {
        setIsRefreshing(true);
        try {
            await refreshFeedMutation.mutateAsync();
        } catch {
            // Error is handled in onError
        }
    };

    const handleLogout = async () => {
        try {
            // Clear IndexedDB (Dexie)
            await db.delete();
        } catch (e) {
            console.error("Failed to delete DB", e);
        }

        // Clear localStorage
        localStorage.clear();

        // Clear sessionStorage
        sessionStorage.clear();

        // Clear React Query cache
        queryClient.clear();

        // Clear Cache Storage (Service Worker caches)
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            } catch (e) {
                console.error("Failed to clear caches", e);
            }
        }

        // Sign out from auth
        await signOut();

        // Reload to ensure clean state
        window.location.reload();
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-white/95 backdrop-blur-xl border-b border-zinc-100/80 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] flex items-center justify-between px-4 max-w-lg mx-auto">
            {/* Brand / Title - Clickable to navigate home */}
            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95"
                aria-label="Go to home"
            >
                <img src="/logo.svg" alt="Din" className="h-8 w-8" />
                <span className="text-lg font-bold text-zinc-900 tracking-tight">din</span>
                <span className="text-xs text-zinc-400 font-medium px-2 py-0.5 bg-zinc-100/80 rounded-full">v2</span>
            </button>

            {/* Right side: Hamburger Menu + Profile */}
            <div className="flex items-center gap-2">
                {/* Hamburger Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-zinc-200">
                            <Menu className="w-5 h-5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2">
                        <DropdownMenuItem
                            onClick={() => navigate('/timeline')}
                            className="cursor-pointer"
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Timeline</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleRefreshFeed}
                            disabled={isRefreshing}
                            className="cursor-pointer"
                        >
                            <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => signIn.social({
                                provider: 'google',
                                callbackURL: '/'
                            })}
                            className="cursor-pointer"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            <span>Switch Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleLogout}
                            className="cursor-pointer text-zinc-600 focus:text-zinc-600 focus:bg-zinc-50"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Profile Avatar */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all active:scale-95">
                            <Avatar className="h-8 w-8 border border-zinc-200/80">
                                <AvatarImage src={user.image || undefined} alt={user.name} />
                                <AvatarFallback className="bg-zinc-100/80 text-zinc-500">
                                    <UserCircle className="w-5 h-5" />
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2">
                        <DropdownMenuItem
                            onClick={() => signIn.social({
                                provider: 'google',
                                callbackURL: '/'
                            })}
                            className="cursor-pointer"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            <span>Switch Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleLogout}
                            className="cursor-pointer text-zinc-600 focus:text-zinc-600 focus:bg-zinc-50"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
