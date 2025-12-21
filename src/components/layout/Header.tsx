import { useNavigate } from 'react-router-dom';
import { UserCircle, RefreshCcw, LogOut } from 'lucide-react';
import { type Session, signOut, signIn } from '@/lib/auth-client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/db';

interface HeaderProps {
    user: Session['user'];
}

export function Header({ user }: HeaderProps) {
    const navigate = useNavigate();

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

    return (
        <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-between px-4 max-w-lg mx-auto">
            {/* Brand / Title */}
            <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-zinc-900 tracking-tight">din</span>
                <span className="text-xs text-zinc-400 font-medium px-2 py-0.5 bg-zinc-100 rounded-full">v2</span>
            </div>

            {/* Profile Action */}
            <div className="flex items-center">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all active:scale-95">
                            <Avatar className="h-8 w-8 border border-zinc-200">
                                <AvatarImage src={user.image || undefined} alt={user.name} />
                                <AvatarFallback className="bg-zinc-100 text-zinc-500">
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
