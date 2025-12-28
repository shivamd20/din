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
            {/* Subtle Background Decor */}
            <div className="absolute top-0 left-0 w-full h-[20vh] bg-gradient-to-b from-zinc-50/50 to-transparent pointer-events-none" />

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-0 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
                        <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4 text-zinc-600 shadow-sm ring-1 ring-zinc-200/50">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-zinc-700 font-medium text-base">Chat with DIN</p>
                        <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
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
                                    "max-w-[85%] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
                                    isUser
                                        ? "bg-zinc-900 text-white rounded-2xl rounded-tr-sm shadow-sm"
                                        : "bg-white border border-zinc-200/80 text-zinc-800 rounded-2xl rounded-tl-sm shadow-sm"
                                )}
                            >
                                {(m as any).content}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="bg-white border border-zinc-200/80 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-2" />
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="p-4 bg-white/95 backdrop-blur-xl border-t border-zinc-100/80 shadow-[0_-2px_20px_-8px_rgba(0,0,0,0.08)]">
                <div className="relative flex items-end gap-2 bg-white rounded-2xl border border-zinc-200/80 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200/50 focus-within:border-zinc-300 transition-all">
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
                        className="mb-1.5 mr-1.5 p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 transition-all active:scale-95 shadow-sm"
                    >
                        <SendHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
