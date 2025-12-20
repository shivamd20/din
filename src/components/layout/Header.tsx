import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, UserCircle, RefreshCcw, LogOut } from 'lucide-react';
import { useSession, signOut, signIn } from '@/lib/auth-client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/db';

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { data: session } = useSession();
    const isHome = location.pathname === '/';
    const user = session?.user;

    const handleLogout = async () => {
        try {
            await db.delete();
        } catch (e) {
            console.error("Failed to delete DB", e);
        }
        localStorage.clear();
        await signOut();
        window.location.reload();
    };

    if (!user) return null;

    return (
        <header className="flex-none p-4 flex justify-between items-center z-10 bg-transparent min-h-[4rem]">
            {/* Left Action */}
            <div className="w-10">
                {isHome ? (
                    <button
                        onClick={() => navigate('/timeline')}
                        className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 transition-colors rounded-full hover:bg-zinc-100"
                        title="Timeline"
                    >
                        <Clock className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 transition-colors rounded-full hover:bg-zinc-100"
                        title="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Center Title */}
            <div className="flex-1 text-center">
                {!isHome && (
                    <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase">
                        Timeline
                    </h1>
                )}
            </div>

            {/* Right Profile Action */}
            <div className="w-10 flex justify-end">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-400 shadow-sm border border-gray-200">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user.image || undefined} alt={user.name} />
                                <AvatarFallback className="bg-gray-200 text-gray-500">
                                    <UserCircle className="w-5 h-5" />
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
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
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
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
