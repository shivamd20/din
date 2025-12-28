import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { ExpandableMarkdown } from "./ExpandableMarkdown";
import { cn } from "@/lib/utils";
import { ImageOff, FileText, Loader2, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function TimelinePage() {
    const navigate = useNavigate();
    const entries = useLiveQuery(() =>
        db.entries.orderBy('created_at').reverse().limit(100).toArray()
    );

    // Grouping Logic - Unconditional Hook
    const { groups, threads } = useMemo(() => {
        if (!entries) return { groups: [], threads: new Map<string, typeof entries>() };

        const t = new Map<string, typeof entries>();
        entries.forEach(e => {
            const rootId = e.rootId || e.id;
            if (!t.has(rootId)) t.set(rootId, []);
            t.get(rootId)?.push(e);
        });

        const sortedIds = Array.from(t.keys()).sort((a, b) => {
            const rootA = t.get(a)?.find(e => e.id === a) || t.get(a)?.[0];
            const rootB = t.get(b)?.find(e => e.id === b) || t.get(b)?.[0];
            return (rootB?.created_at || 0) - (rootA?.created_at || 0);
        });

        const g: { dateLabel: string, threadIds: string[] }[] = [];
        sortedIds.forEach(rootId => {
            const rootEntry = t.get(rootId)?.find(e => e.id === rootId) || t.get(rootId)?.[0];
            if (!rootEntry) return;

            const date = new Date(rootEntry.created_at);
            const now = new Date();
            const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

            let label = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
            if (isToday) label = "Today";
            if (isYesterday) label = "Yesterday";

            let last = g[g.length - 1];
            if (!last || last.dateLabel !== label) {
                g.push({ dateLabel: label, threadIds: [] });
                last = g[g.length - 1];
            }
            last.threadIds.push(rootId);
        });

        return { groups: g, threads: t };
    }, [entries]);

    if (!entries) return (
        <div className="h-full w-full flex items-center justify-center bg-white">
            <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
        </div>
    );

    if (entries.length === 0) return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32 flex flex-col items-center justify-center text-center px-8 opacity-0 animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-zinc-100">
                <span className="text-3xl opacity-40 grayscale">📸</span>
            </div>
            <p className="text-zinc-900 font-medium tracking-tight text-lg">Your Journal is Empty</p>
            <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
                Capture your thoughts, ideas, and moments to build your personal timeline.
            </p>
        </div>
    );

    return (
        <div className="h-full w-full bg-white overflow-y-auto overscroll-y-contain pb-32">
            {/* Navigation Button to Signals */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-zinc-100/50 px-6 py-3 flex justify-end">
                <button
                    onClick={() => navigate('/signals')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Signals & Commitments</span>
                </button>
            </div>

            {entries.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-0 animate-in fade-in duration-700">
                    <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-zinc-100">
                        <span className="text-3xl opacity-40 grayscale">📸</span>
                    </div>
                    <p className="text-zinc-900 font-medium tracking-tight text-lg">Your Journal is Empty</p>
                    <p className="text-zinc-400 text-sm mt-2 max-w-xs leading-relaxed">
                        Capture your thoughts, ideas, and moments to build your personal timeline.
                    </p>
                </div>
            )}

            <div className="max-w-xl mx-auto px-6 py-6 space-y-10">
                {groups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-6">
                        {/* Sticky Date Header */}
                        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl py-4 -mx-6 px-6 border-b border-zinc-100/50 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.05)] transition-all">
                            <span className="text-[13px] font-bold text-zinc-800 tracking-wider uppercase opacity-90">
                                {group.dateLabel}
                            </span>
                        </div>

                        <div className="relative pl-4 sm:pl-0">
                            {/* Dotted Line for Day Group (Desktop) */}
                            <div className="absolute left-[85px] top-6 bottom-0 w-px bg-zinc-100 hidden sm:block" />
                            {/* Line for Mobile */}
                            <div className="absolute left-0 top-6 bottom-0 w-px bg-zinc-100 sm:hidden" />

                            <div className="space-y-10">
                                {group.threadIds.map(rootId => {
                                    const thread = threads.get(rootId)!;
                                    thread.sort((a, b) => a.created_at - b.created_at);
                                    const rootEntry = thread[0];
                                    const time = new Date(rootEntry.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

                                    return (
                                        <div key={rootId} className="relative flex flex-col sm:flex-row gap-2 sm:gap-6 group">
                                            {/* Desktop Timeline Left */}
                                            <div className="hidden sm:flex w-[60px] flex-col items-end pt-1">
                                                <span className="text-xs text-zinc-400 font-medium tracking-wide">{time}</span>
                                            </div>

                                            {/* Desktop Dot */}
                                            <div className="hidden sm:flex absolute left-[81px] top-[7px] w-2.5 h-2.5 rounded-full bg-white border-2 border-zinc-200 z-10 group-hover:border-zinc-900 transition-colors" />

                                            {/* Mobile Time + Dot */}
                                            <div className="sm:hidden flex items-center gap-3 mb-1 -ml-[21px]">
                                                <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-zinc-300 z-10" />
                                                <span className="text-xs text-zinc-400 font-medium tracking-wide">{time}</span>
                                            </div>

                                            {/* Content Body */}
                                            <div className="flex-1 min-w-0 pl-1 sm:pl-0">
                                                {/* Text Content */}
                                                <div className="text-[15px] sm:text-[16px] leading-relaxed text-zinc-800 font-normal break-words">
                                                    <ExpandableMarkdown content={rootEntry.text} />
                                                </div>

                                                {/* Attachments Grid */}
                                                {rootEntry.attachments && rootEntry.attachments.length > 0 && (
                                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                                        {rootEntry.attachments.map(att => (
                                                            <AttachmentThumbnail key={att.id} att={att} />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Replies */}
                                                {thread.length > 1 && (
                                                    <div className="mt-4 space-y-4">
                                                        {thread.slice(1).map(reply => (
                                                            <div key={reply.id} className="relative pl-4 border-l-2 border-zinc-100/80">
                                                                <div className="text-[14px] text-zinc-600">
                                                                    <ExpandableMarkdown content={reply.text} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Footer / Status */}
                                                <div className="mt-3 flex items-center gap-3">
                                                    {rootEntry.synced === 0 && (
                                                        <span className="text-[10px] text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                                                            Syncing...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AttachmentThumbnail({ att }: { att: any }) {
    const [error, setError] = useState(false);

    // Robust source resolution
    const src = useMemo(() => {
        if (att.blob instanceof Blob) {
            return URL.createObjectURL(att.blob);
        }
        if (att.key) return `/api/files/${att.key}`; // Proxied via worker
        return null;
    }, [att]);

    const isImage = att.type === 'image' || (typeof att.type === 'string' && att.type.startsWith('image/'));

    if (isImage) {
        if (!src || error) {
            return (
                <div className="aspect-[4/3] rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center justify-center text-zinc-300 gap-2">
                    <ImageOff className="w-5 h-5 opacity-50" />
                    <span className="text-[10px] uppercase tracking-wider font-medium opacity-50">Error</span>
                </div>
            );
        }
        return (
            <div className="relative aspect-[4/3] rounded-2xl bg-zinc-100 border border-zinc-200/50 overflow-hidden shadow-sm group cursor-zoom-in">
                <img
                    src={src}
                    onError={() => setError(true)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt="attachment"
                    loading="lazy"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-2xl pointer-events-none" />
            </div>
        );
    }

    // File fallback
    return (
        <a href={src || '#'} target="_blank" className="aspect-[4/3] rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col items-center justify-center p-4 text-center hover:bg-zinc-100 transition-all group active:scale-95">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-zinc-100 flex items-center justify-center mb-3 group-hover:shadow-md transition-all">
                <FileText className="w-5 h-5 text-zinc-500" />
            </div>
            <span className="text-xs text-zinc-600 font-medium truncate w-full px-2">{att.name || "File"}</span>
        </a>
    );
}
