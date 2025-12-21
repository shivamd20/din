import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { ExpandableMarkdown } from "./ExpandableMarkdown";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export default function TimelinePage() {
    const entries = useLiveQuery(() =>
        db.entries.orderBy('created_at').reverse().limit(100).toArray()
    );

    if (!entries) return (
        <div className="h-full w-full flex items-center justify-center bg-white">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
    );

    // Grouping Logic
    const threads = new Map<string, typeof entries>();
    entries.forEach(e => {
        const rootId = e.rootId || e.id;
        if (!threads.has(rootId)) threads.set(rootId, []);
        threads.get(rootId)?.push(e);
    });

    const sortedThreadIds = Array.from(threads.keys()).sort((a, b) => {
        const rootA = threads.get(a)?.find(e => e.id === a) || threads.get(a)?.[0];
        const rootB = threads.get(b)?.find(e => e.id === b) || threads.get(b)?.[0];
        return (rootB?.created_at || 0) - (rootA?.created_at || 0);
    });

    const groups: { dateLabel: string, threadIds: string[] }[] = [];
    sortedThreadIds.forEach(rootId => {
        const rootEntry = threads.get(rootId)?.find(e => e.id === rootId) || threads.get(rootId)?.[0];
        if (!rootEntry) return;

        const date = new Date(rootEntry.created_at);
        let label = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);

        const now = new Date();
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

        if (isToday) label = "Today";
        if (isYesterday) label = "Yesterday";

        let lastGroup = groups[groups.length - 1];
        if (!lastGroup || lastGroup.dateLabel !== label) {
            groups.push({ dateLabel: label, threadIds: [] });
            lastGroup = groups[groups.length - 1];
        }
        lastGroup.threadIds.push(rootId);
    });

    return (
        <div className="h-full w-full bg-white overflow-y-auto overflow-x-hidden">
            {entries.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
                        <span className="text-2xl opacity-50">📷</span>
                    </div>
                    <p className="text-zinc-900 font-medium">No moments yet</p>
                    <p className="text-zinc-400 text-sm mt-1">Capture your first thought to see it here.</p>
                </div>
            )}

            <div className="max-w-xl mx-auto px-5 py-8 space-y-12">
                {groups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-6">
                        {/* Date Header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md py-3 -mx-5 px-5 border-b border-zinc-50 transition-all">
                            <span className="text-[13px] font-semibold text-zinc-900 tracking-wide uppercase">
                                {group.dateLabel}
                            </span>
                        </div>

                        <div className="space-y-8 relative">
                            {/* Dotted Line for Day Group */}
                            <div className="absolute left-[85px] top-2 bottom-2 w-px bg-zinc-100 hidden sm:block" />

                            {group.threadIds.map(rootId => {
                                const thread = threads.get(rootId)!;
                                thread.sort((a, b) => a.created_at - b.created_at);
                                const rootEntry = thread[0]; // Assuming sorted
                                const time = new Date(rootEntry.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

                                return (
                                    <div key={rootId} className="relative flex gap-4 sm:gap-6 group">
                                        {/* Time Column (Desktop) */}
                                        <div className="hidden sm:block w-[60px] text-right pt-[2px]">
                                            <span className="text-xs text-zinc-400 font-medium">{time}</span>
                                        </div>

                                        {/* Timeline Dot (Desktop) */}
                                        <div className="hidden sm:flex flex-col items-center pt-[6px]">
                                            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200 border-2 border-white shadow-[0_0_0_1px_rgba(228,228,231,0.5)] z-10 group-hover:bg-zinc-900 transition-colors" />
                                        </div>

                                        {/* Content Body */}
                                        <div className="flex-1 min-w-0 pb-2">

                                            {/* Mobile Header (Time + Dot) */}
                                            <div className="sm:hidden flex items-center gap-2 mb-1.5 opacity-60">
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                                <span className="text-xs text-zinc-500 font-medium">{time}</span>
                                            </div>

                                            {/* Text */}
                                            <div className="text-[15px] leading-relaxed text-zinc-800">
                                                <ExpandableMarkdown content={rootEntry.text} />
                                            </div>

                                            {/* Attachments */}
                                            {rootEntry.attachments && rootEntry.attachments.length > 0 && (
                                                <div className="mt-4 grid grid-cols-2 gap-3">
                                                    {rootEntry.attachments.map(att => (
                                                        <AttachmentThumbnail key={att.id} att={att} />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Replies (if any) */}
                                            {thread.slice(1).map(reply => (
                                                <div key={reply.id} className="mt-4 pl-4 border-l-2 border-zinc-100">
                                                    <div className="text-sm text-zinc-700">
                                                        <ExpandableMarkdown content={reply.text} />
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Sync Status */}
                                            {rootEntry.synced === 0 && (
                                                <div className="mt-2 text-[10px] text-blue-500 font-medium flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                    Syncing...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Padding for Nav */}
            <div className="h-24" />
        </div>
    );
}

function AttachmentThumbnail({ att }: { att: any }) {
    const [error, setError] = useState(false);

    let src = '';
    if (att.blob) src = URL.createObjectURL(att.blob);
    else if (att.key) src = `/api/files/${att.key}`;

    if (att.type === 'image') {
        if (!src || error) {
            return (
                <div className="aspect-[4/3] rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300">
                    <ImageOff className="w-6 h-6" />
                </div>
            );
        }
        return (
            <div className="relative aspect-[4/3] rounded-xl bg-zinc-100 border border-zinc-200/50 overflow-hidden shadow-sm transition-all hover:shadow-md cursor-zoom-in group">
                <img
                    src={src}
                    onError={() => setError(true)}
                    className="w-full h-full object-cover"
                    alt="attachment"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            </div>
        );
    }

    return (
        <a href={src} target="_blank" className="aspect-[4/3] rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col items-center justify-center p-4 text-center hover:bg-zinc-100 transition-all group">
            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span className="text-xl">📄</span>
            </div>
            <span className="text-xs text-zinc-600 font-medium truncate w-full px-2">{att.name}</span>
        </a>
    );
}
