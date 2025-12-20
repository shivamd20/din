import { signIn } from '@/lib/auth-client';

interface GuestBannerProps {
    isAnonymous?: boolean;
}

export function GuestBanner({ isAnonymous }: GuestBannerProps) {
    if (!isAnonymous) return null;

    return (
        <div className="flex-none w-full bg-amber-50/90 backdrop-blur-sm border-t border-amber-100 pb-[env(safe-area-inset-bottom)] z-50">
            <div className="px-4 py-2 text-xs md:text-sm text-amber-800 text-center flex items-center justify-center gap-2">
                <span>Guest Account.</span>
                <button
                    onClick={() => signIn.social({
                        provider: 'google',
                        callbackURL: '/'
                    })}
                    className="underline font-medium hover:text-amber-900"
                >
                    Sign in to save data
                </button>
            </div>
        </div>
    );
}
