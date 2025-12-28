import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Sparkles, Zap, MessageSquare, Target, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WelcomeScreen() {
    const [isSigningIn, setIsSigningIn] = useState<'anonymous' | 'google' | null>(null);

    const handleAnonymousSignIn = async () => {
        setIsSigningIn('anonymous');
        try {
            await signIn.anonymous();
        } catch (error) {
            console.error('Anonymous sign in failed:', error);
            setIsSigningIn(null);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsSigningIn('google');
        try {
            await signIn.social({
                provider: 'google',
                callbackURL: '/'
            });
        } catch (error) {
            console.error('Google sign in failed:', error);
            setIsSigningIn(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto overscroll-y-contain">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 via-white to-white pointer-events-none" />
            
            <div className="relative max-w-lg mx-auto px-6 py-12 pb-20 min-h-full flex flex-col">
                {/* Hero Section */}
                <div className="text-center mb-16 mt-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 text-white mb-6 shadow-lg">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">
                        DIN.
                    </h1>
                    <p className="text-xl text-zinc-600 font-medium mb-6 leading-relaxed">
                        A calmer way to run your day
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed max-w-md mx-auto mb-8">
                        <strong className="text-zinc-700 font-semibold">Think less. Live more.</strong> DIN quietly helps you capture life, understand it, and nudge you forward without pressure.
                    </p>
                </div>

                {/* Hero Description */}
                <div className="mb-16">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-3">
                        A personal assistant that learns from your life, not your tasks.
                    </h2>
                    <p className="text-[15px] text-zinc-600 leading-relaxed">
                        DIN invites you to jot anything at any time. No structure required. No maintenance. It notices patterns, offers thoughtful commitments, and keeps your day clear and manageable.
                    </p>
                </div>

                {/* Primary Action */}
                <div className="mb-20">
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isSigningIn !== null}
                        className={cn(
                            "w-full py-4 px-6 bg-zinc-900 text-white rounded-2xl font-semibold text-base shadow-sm hover:shadow-md hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                            isSigningIn === 'google' && "opacity-75"
                        )}
                    >
                        {isSigningIn === 'google' ? 'Connecting...' : 'Get started'}
                    </button>
                    <p className="text-xs text-zinc-400 text-center mt-3">
                        Use Google if you want your data available everywhere.
                    </p>
                </div>

                {/* Why it matters */}
                <div className="mb-16 space-y-12">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-blue-100/50">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900">Capture freely</h3>
                        </div>
                        <p className="text-[15px] text-zinc-600 leading-relaxed pl-[52px]">
                            Type what is on your mind. Thoughts, reminders, worries, ideas. DIN organizes meaning in the background so you do not have to.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-100/50">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900">Guidance that feels human</h3>
                        </div>
                        <p className="text-[15px] text-zinc-600 leading-relaxed pl-[52px]">
                            DIN explains choices, adapts to your reality, and helps you adjust when plans change. Calm, steady, and never guilt driven.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm ring-1 ring-emerald-100/50">
                                <Target className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900">Commitments that grow naturally</h3>
                        </div>
                        <p className="text-[15px] text-zinc-600 leading-relaxed pl-[52px]">
                            When a positive pattern appears, DIN asks if you want to formalize it. You stay in control at every step.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm ring-1 ring-purple-100/50">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900">A place to think together</h3>
                        </div>
                        <p className="text-[15px] text-zinc-600 leading-relaxed pl-[52px]">
                            Use chat to reflect, plan, or ask questions about what is ahead. Planning becomes a conversation, not a chore.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm ring-1 ring-amber-100/50">
                                <WifiOff className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900">Ready when you are, even without internet</h3>
                        </div>
                        <p className="text-[15px] text-zinc-600 leading-relaxed pl-[52px]">
                            Core features continue offline. Everything syncs once you are back.
                        </p>
                    </div>
                </div>

                {/* Getting Started */}
                <div className="mb-12">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-6 text-center">Getting started</h2>
                    <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
                        <div className="space-y-4">
                            <button
                                onClick={handleAnonymousSignIn}
                                disabled={isSigningIn !== null}
                                className={cn(
                                    "w-full py-4 px-6 bg-white border-2 border-zinc-200 text-zinc-900 rounded-xl font-semibold text-base shadow-sm hover:shadow-md hover:border-zinc-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                                    isSigningIn === 'anonymous' && "opacity-75"
                                )}
                            >
                                {isSigningIn === 'anonymous' ? 'Starting...' : 'Get started anonymously'}
                            </button>
                            <p className="text-xs text-zinc-500 text-center px-2">
                                Creates a temporary space so you can try DIN immediately.
                            </p>

                            <div className="pt-2">
                                <button
                                    onClick={handleGoogleSignIn}
                                    disabled={isSigningIn !== null}
                                    className={cn(
                                        "w-full py-4 px-6 bg-zinc-900 text-white rounded-xl font-semibold text-base shadow-sm hover:shadow-md hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                                        isSigningIn === 'google' && "opacity-75"
                                    )}
                                >
                                    {isSigningIn === 'google' ? 'Connecting...' : 'Continue with Google'}
                                </button>
                                <p className="text-xs text-zinc-500 text-center px-2 mt-2">
                                    Saves everything securely across devices.
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-400 text-center mt-6 pt-4 border-t border-zinc-100">
                            You can connect Google later to keep your progress safe.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

