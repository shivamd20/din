import { useNavigate } from 'react-router-dom';
import { useSession, signIn, signOut } from '@/lib/auth-client';
import { User, LogOut, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
    const { data: session } = useSession();
    const navigate = useNavigate();

    const handleGoogle = async () => {
        await signIn.social({
            provider: 'google',
            callbackURL: '/'
        });
    };

    // @ts-ignore
    if (session?.user && !session.user.isAnonymous) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 text-center">
                    <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
                        {session.user.image ? (
                            <img src={session.user.image} alt={session.user.name} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-10 h-10 text-gray-500 m-5" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{session.user.name}</h2>
                    <p className="text-gray-500 mb-6">{session.user.email}</p>

                    <button
                        onClick={() => signOut()}
                        className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>

                    <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
                        Go to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome to Din</h1>
                    <p className="text-gray-500 mt-2">Sign in to continue</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogle}
                        className="w-full py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    {/* @ts-ignore */}
                    {(!session?.user?.isAnonymous) && (
                        <>
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                            </div>

                            <button
                                onClick={async () => {
                                    await signIn.anonymous();
                                    navigate('/');
                                }}
                                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium rounded-xl transition-all flex items-center justify-center gap-3"
                            >
                                <User className="w-5 h-5" />
                                Continue as Guest
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
