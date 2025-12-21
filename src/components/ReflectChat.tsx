import React, { useEffect, useRef } from 'react';
import { useChat, type Message } from '../hooks/use-chat';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReflectChat() {
    const { messages, input, setInput, append, isLoading } = useChat();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!input.trim()) return;
            append({ role: 'user', content: input });
            setInput('');
        }
    };

    const intents = [
        "Reflect on how you are growing",
        "Identify what to improve next",
        "Notice patterns in how you work",
        "Decide what to double down on"
    ];
    const intent = useRef(intents[Math.floor(Math.random() * intents.length)]).current;

    return (
        <div className="h-full flex flex-col bg-[#fcfcfc] text-zinc-800">
            {/* Intent Header */}
            <header className="px-6 py-6 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-zinc-400 tracking-wide uppercase opacity-70">
                    Debrief
                </span>
                <div className="w-5" /> {/* Spacer */}
            </header>

            <div className="px-6 pb-2">
                <h1 className="text-2xl font-light text-zinc-800 leading-snug tracking-tight">
                    {intent}
                </h1>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        <div
                            className={`max-w-[90%] text-lg leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                    ? 'text-zinc-900 border-l-2 border-zinc-200 pl-4 py-1'
                                    : 'text-zinc-600'
                                }`}
                        >
                            {m.content}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="text-zinc-300 text-sm animate-pulse">Thinking...</div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Composer */}
            <div className="p-6 pb-10">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="What pattern are you noticing?"
                    className="w-full bg-transparent border-none text-xl resize-none outline-none text-zinc-800 placeholder:text-zinc-300"
                    rows={3}
                    style={{ minHeight: '80px' }}
                />
                <div className="text-right">
                    {/* Subtle send hint if needed, or just rely on Enter */}
                    <span className="text-xs text-zinc-300">Enter to reflect</span>
                </div>
            </div>
        </div>
    );
}
