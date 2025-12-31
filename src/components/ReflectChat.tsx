import React, { useEffect, useRef, useState } from 'react';
import { useChat as useTanstackChat } from '@tanstack/ai-react';
import { fetchServerSentEvents } from '@tanstack/ai-client';
import { SendHorizontal, Sparkles, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntryCard, TaskCard, CommitmentCard } from './chat';
import MDEditor from '@uiw/react-md-editor';

export default function ReflectChat() {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const connection = fetchServerSentEvents('/api/chat', {
        body: (messages: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; [key: string]: unknown }> }>) => {
            const serverMessages = messages.map((msg) => {
                const textParts = msg.parts
                    .filter((part) => part.type === 'text')
                    .map((part) => (part as { type: 'text'; content: string }).content)
                    .join('');
                
                return {
                    role: msg.role,
                    content: textParts,
                };
            });

            return JSON.stringify({
                messages: serverMessages,
            });
        },
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const {
        messages,
        sendMessage,
        isLoading,
        error,
    } = useTanstackChat({
        connection,
        onError: (e: Error) => console.error('Chat error:', e),
    });

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
            sendMessage(input);
            setInput('');
        }
    };

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        sendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col flex-1 w-full relative bg-zinc-50/30 overflow-hidden" data-color-mode="light">
            <style>{`
                /* Markdown styling for chat */
                .wmde-markdown ::selection,
                .wmde-markdown *::selection {
                    background-color: #bfdbfe !important;
                    color: #1f2937 !important;
                    -webkit-text-fill-color: #1f2937 !important;
                }
                .wmde-markdown {
                    background-color: transparent !important;
                }
                .wmde-markdown p {
                    margin: 0.5em 0;
                }
                .wmde-markdown p:first-child {
                    margin-top: 0;
                }
                .wmde-markdown p:last-child {
                    margin-bottom: 0;
                }
                .wmde-markdown code {
                    background-color: rgba(0, 0, 0, 0.05);
                    padding: 0.2em 0.4em;
                    border-radius: 0.25rem;
                    font-size: 0.9em;
                }
                .wmde-markdown pre {
                    background-color: rgba(0, 0, 0, 0.05);
                    padding: 0.75em;
                    border-radius: 0.5rem;
                    overflow-x: auto;
                }
                .wmde-markdown pre code {
                    background-color: transparent;
                    padding: 0;
                }
                .wmde-markdown ul, .wmde-markdown ol {
                    margin: 0.5em 0;
                    padding-left: 1.5em;
                }
                .wmde-markdown blockquote {
                    border-left: 3px solid #e5e7eb;
                    padding-left: 1em;
                    margin: 0.5em 0;
                    color: #6b7280;
                }
            `}</style>
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
                    
                    // Extract text content
                    const textParts = m.parts
                        .filter((part) => part.type === 'text')
                        .map((part) => (part as { type: 'text'; content: string }).content)
                        .join('');

                    // Extract tool calls (client tools)
                    const toolCalls = m.parts
                        .filter((part) => part.type === 'tool-call')
                        .map((part) => part as { 
                            type: 'tool-call'; 
                            id?: string;
                            name: string; 
                            input?: unknown;
                            state?: string;
                            output?: unknown;
                        });

                    // Extract tool results (server tools)
                    const toolResults = m.parts
                        .filter((part) => {
                            const partType = (part as { type?: string }).type;
                            return partType === 'tool-result' || partType === 'tool-call-result';
                        })
                        .map((part) => {
                            // Handle different possible structures
                            const p = part as { type: string; name?: string; toolName?: string; output?: unknown; result?: unknown };
                            return {
                                name: p.name || p.toolName || '',
                                output: p.output || p.result || null,
                            };
                        })
                        .filter((tr) => tr.name && tr.output !== null);

                    return (
                        <div
                            key={m.id || i}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                isUser ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className={cn(
                                "max-w-[85%] space-y-3",
                                !isUser && "w-full"
                            )}>
                                {/* Text content with markdown rendering */}
                                {textParts && (
                                    <div
                                        className={cn(
                                            "px-4 py-3 text-[15px] leading-relaxed rounded-2xl shadow-sm",
                                            isUser
                                                ? "bg-zinc-900 text-white rounded-tr-sm"
                                                : "bg-white border border-zinc-200/80 text-zinc-800 rounded-tl-sm"
                                        )}
                                        data-color-mode="light"
                                    >
                                        {isUser ? (
                                            <div className="whitespace-pre-wrap">{textParts}</div>
                                        ) : (
                                            <MDEditor.Markdown
                                                source={textParts}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    color: '#27272a',
                                                    fontSize: '15px',
                                                    lineHeight: '1.6',
                                                }}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Tool calls (client tools) */}
                                {!isUser && toolCalls.length > 0 && (
                                    <div className="space-y-2">
                                        {toolCalls.map((toolCall, toolCallIdx) => {
                                            const isPending = toolCall.state === 'awaiting-input' || toolCall.state === 'input-streaming';
                                            const isComplete = toolCall.state === 'input-complete' || toolCall.output !== undefined;
                                            
                                            return (
                                                <div
                                                    key={toolCall.id || toolCallIdx}
                                                    className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl"
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Wrench className="w-4 h-4 text-zinc-500" />
                                                        <span className="text-sm font-medium text-zinc-700">
                                                            {toolCall.name}
                                                        </span>
                                                        {isPending && (
                                                            <span className="text-xs text-zinc-400">Executing...</span>
                                                        )}
                                                        {isComplete && (
                                                            <span className="text-xs text-green-600">✓ Complete</span>
                                                        )}
                                                    </div>
                                                    {toolCall.input && (
                                                        <div className="text-xs text-zinc-600 mt-1">
                                                            <pre className="whitespace-pre-wrap font-mono bg-white p-2 rounded border border-zinc-200">
                                                                {JSON.stringify(toolCall.input, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {toolCall.output && (
                                                        <div className="text-xs text-zinc-600 mt-2">
                                                            <div className="font-medium mb-1">Result:</div>
                                                            <pre className="whitespace-pre-wrap font-mono bg-white p-2 rounded border border-zinc-200">
                                                                {JSON.stringify(toolCall.output, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Tool results (server tools) - render data structures */}
                                {!isUser && toolResults.map((toolResult, toolIdx) => {
                                    const { name, output } = toolResult;
                                    
                                    // Handle getEntries
                                    if (name === 'getEntries' && Array.isArray(output)) {
                                        return (
                                            <div key={toolIdx} className="space-y-3">
                                                {output.map((entry: any, entryIdx: number) => (
                                                    <EntryCard key={entry.id || entryIdx} entry={entry} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    // Handle getTasks
                                    if (name === 'getTasks' && Array.isArray(output)) {
                                        return (
                                            <div key={toolIdx} className="space-y-3">
                                                {output.map((task: any, taskIdx: number) => (
                                                    <TaskCard key={task.id || taskIdx} task={task} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    // Handle getCommitments
                                    if (name === 'getCommitments' && Array.isArray(output)) {
                                        return (
                                            <div key={toolIdx} className="space-y-3">
                                                {output.map((commitment: any, commitmentIdx: number) => (
                                                    <CommitmentCard key={commitment.id || commitmentIdx} commitment={commitment} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    return null;
                                })}
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
                        onClick={handleSend}
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
