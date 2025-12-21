import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/use-chat';
import { SendHorizontal, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReflectChat() {
    const { messages, sendMessage, status } = useChat({
        onError: (e: Error) => console.error('Chat error:', e),
        onFinish: (m: any) => console.log('Chat finished:', m),
        onResponse: (r: Response) => console.log('Chat response received', r.status, r.statusText)
    });
    const [input, setInput] = useState('');
    const isLoading = status === 'submitted' || status === 'streaming';
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!input.trim() || isLoading) return;
            sendMessage({ role: 'user', content: input } as any);
            setInput('');
        }
    };

    return (
        <div className="flex flex-col flex-1 w-full relative bg-zinc-50/30 overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-[30vh] bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none" />

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-0 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-zinc-500 font-medium">Reflect & Grow</p>
                        <p className="text-zinc-400 text-sm mt-1 max-w-xs">
                            How are you feeling today? What patterns are you noticing?
                        </p>
                    </div>
                )}

                {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    return (
                        <div
                            key={i}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                isUser ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] px-5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm",
                                    isUser
                                        ? "bg-zinc-900 text-white rounded-2xl rounded-tr-sm"
                                        : "bg-white border border-zinc-100 text-zinc-800 rounded-2xl rounded-tl-sm"
                                )}
                            >
                                {(m as any).content}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="bg-white border border-zinc-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-2" />
            </div>

            {/* Input Area - Fixed at bottom of container */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-t border-zinc-100">
                <div className="relative flex items-end gap-2 bg-white rounded-[24px] border border-zinc-200 shadow-sm focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-200 transition-all">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message..."
                        className="w-full bg-transparent border-none text-[16px] resize-none outline-none text-zinc-900 placeholder:text-zinc-400 px-4 py-3.5 max-h-[120px] min-h-[52px]"
                        rows={1}
                        style={{ height: 'auto', minHeight: '52px' }}
                    />
                    <button
                        onClick={() => {
                            if (!input.trim() || isLoading) return;
                            sendMessage({ role: 'user', content: input } as any);
                            setInput('');
                        }}
                        disabled={!input.trim() || isLoading}
                        className="mb-1.5 mr-1.5 p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        <SendHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
