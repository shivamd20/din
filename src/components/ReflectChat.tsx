import React, { useEffect, useRef, useState } from 'react';
import { useChat as useTanstackChat } from '@tanstack/ai-react';
import { fetchServerSentEvents } from '@tanstack/ai-client';
import { SendHorizontal, Sparkles, Wrench, ChevronDown, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntryCard, TaskCard, CommitmentCard } from './chat';
import MDEditor from '@uiw/react-md-editor';
import { trpc } from '@/lib/trpc';

export default function ReflectChat() {
    const [input, setInput] = useState('');
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [showChatDropdown, setShowChatDropdown] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch chat list
    const { data: chats = [], refetch: refetchChats } = trpc.chats.list.useQuery();

    // Fetch current chat messages if chatId is set
    const { data: currentChatData } = trpc.chats.get.useQuery(
        { chatId: currentChatId! },
        { enabled: !!currentChatId }
    ) as { data?: { chat: { id: string; title: string; created_at: number; updated_at: number }; messages: Array<{ id: string; role: string; parts: unknown[]; createdAt: number }> } | null };

    // Create chat mutation
    const createChatMutation = trpc.chats.create.useMutation({
        onSuccess: (data) => {
            setCurrentChatId(data.chatId);
            refetchChats();
        },
    });

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
                chatId: currentChatId || undefined,
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
        setMessages,
    } = useTanstackChat({
        connection,
        onError: (e: Error) => console.error('Chat error:', e),
        onFinish: () => {
            // Refetch chats after message completes to get updated titles
            refetchChats();
        },
    });

    // Load chat messages when chat is selected
    useEffect(() => {
        if (currentChatData && currentChatData.messages && Array.isArray(currentChatData.messages)) {
            // Convert saved messages to TanStack format
            const tanstackMessages = currentChatData.messages.map((msg) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                parts: (msg.parts || []) as Array<{ type: string; [key: string]: unknown }>,
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMessages(tanstackMessages as any);
        } else if (currentChatId === null) {
            // Clear messages when no chat selected
            setMessages([]);
        }
    }, [currentChatData, currentChatId, setMessages]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowChatDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNewChat = () => {
        setCurrentChatId(null);
        setMessages([]);
        setShowChatDropdown(false);
        inputRef.current?.focus();
    };

    const handleSelectChat = (chatId: string) => {
        setCurrentChatId(chatId);
        setShowChatDropdown(false);
    };

    const currentChat = chats.find(c => c.id === currentChatId);
    const chatTitle = currentChat?.title || 'New Chat';

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
            handleSend();
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        // Create new chat if we don't have one
        if (!currentChatId) {
            const result = await createChatMutation.mutateAsync({ firstUserMessage: input });
            setCurrentChatId(result.chatId);
        }
        
        sendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col flex-1 w-full relative bg-zinc-50/30 overflow-hidden" data-color-mode="light">
            {/* Chat Header with Dropdown */}
            <div className="px-4 py-3 bg-white/95 backdrop-blur-xl border-b border-zinc-100/80 flex items-center justify-between">
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowChatDropdown(!showChatDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors text-left min-w-0 flex-1"
                    >
                        <MessageSquare className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span className="text-sm font-medium text-zinc-900 truncate flex-1">
                            {chatTitle}
                        </span>
                        <ChevronDown className={cn(
                            "w-4 h-4 text-zinc-400 shrink-0 transition-transform",
                            showChatDropdown && "rotate-180"
                        )} />
                    </button>

                    {/* Dropdown Menu */}
                    {showChatDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 max-h-[60vh] overflow-y-auto">
                            <div className="p-1">
                                <button
                                    onClick={handleNewChat}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                                >
                                    <Plus className="w-4 h-4 text-zinc-500" />
                                    <span className="text-sm font-medium text-zinc-900">New Chat</span>
                                </button>
                                <div className="border-t border-zinc-100 my-1" />
                                {chats.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-sm text-zinc-400">
                                        No chat history
                                    </div>
                                ) : (
                                    chats.map((chat) => (
                                        <button
                                            key={chat.id}
                                            onClick={() => handleSelectChat(chat.id)}
                                            className={cn(
                                                "w-full flex flex-col gap-0.5 px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors",
                                                currentChatId === chat.id && "bg-zinc-50"
                                            )}
                                        >
                                            <span className="text-sm font-medium text-zinc-900 truncate">
                                                {chat.title}
                                            </span>
                                            <span className="text-xs text-zinc-400">
                                                {new Date(chat.updated_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
                                                    {toolCall.input !== undefined && (
                                                        <div className="text-xs text-zinc-600 mt-1">
                                                            <pre className="whitespace-pre-wrap font-mono bg-white p-2 rounded border border-zinc-200">
                                                                {JSON.stringify(toolCall.input as Record<string, unknown>, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {toolCall.output !== undefined && (
                                                        <div className="text-xs text-zinc-600 mt-2">
                                                            <div className="font-medium mb-1">Result:</div>
                                                            <pre className="whitespace-pre-wrap font-mono bg-white p-2 rounded border border-zinc-200">
                                                                {JSON.stringify(toolCall.output as Record<string, unknown>, null, 2)}
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
                                                {output.map((entry: { id?: string; [key: string]: unknown }, entryIdx: number) => (
                                                    <EntryCard key={entry.id || `entry-${entryIdx}`} entry={entry as { id: string; text: string; created_at: number; source: string; action_type: string | null; action_context: string | null; linked_task_id: string | null; linked_commitment_id: string | null; [key: string]: unknown }} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    // Handle getTasks
                                    if (name === 'getTasks' && Array.isArray(output)) {
                                        return (
                                            <div key={toolIdx} className="space-y-3">
                                                {output.map((task: { id?: string; [key: string]: unknown }, taskIdx: number) => (
                                                    <TaskCard key={task.id || `task-${taskIdx}`} task={task as { id: string; content: string; status: string; planned_date: number | null; duration_minutes: number; commitment_id: string | null; task_type: string; [key: string]: unknown }} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    // Handle getCommitments
                                    if (name === 'getCommitments' && Array.isArray(output)) {
                                        return (
                                            <div key={toolIdx} className="space-y-3">
                                                {output.map((commitment: { id?: string; [key: string]: unknown }, commitmentIdx: number) => (
                                                    <CommitmentCard key={commitment.id || `commitment-${commitmentIdx}`} commitment={commitment as { id: string; content: string; status: string; health_status: string | null; streak_count: number | null; longest_streak: number | null; completion_percentage: number | null; detected_blockers: string | null; next_step: string | null; user_message: string | null; expires_at: number | null; [key: string]: unknown }} />
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
