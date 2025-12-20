import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { ExpandableMarkdown } from "./ExpandableMarkdown";

export default function TimelinePage() {
    // 7. Infinite Scroll (Phase 1: Simple paging/all load for now as per spec "Load entries from IndexedDB")
    const entries = useLiveQuery(() =>
        db.entries.orderBy('created_at').reverse().limit(50).toArray()
    );

    if (!entries) return null;

    return (
        <div className="h-full w-full bg-gray-50 flex flex-col items-center overflow-y-auto overscroll-y-contain -webkit-overflow-scrolling-touch">
            {/* 5. Layout */}
            <main className="w-full max-w-lg flex-1 px-4 md:px-0 pb-10 space-y-3">
                {/* 8. Empty States */}
                {entries.length === 0 && (
                    <div className="h-[60vh] flex items-center justify-center">
                        <p className="text-zinc-400 text-sm">Anything you log will appear here.</p>
                    </div>
                )}

                {/* 6. Entry Card */}
                {entries.map(entry => {
                    const date = new Date(entry.created_at);

                    // A. Timestamp Logic (Phase 1 Simple)
                    const dateStr = date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const timestamp = `${dateStr}, ${timeStr}`;

                    return (
                        <div key={entry.id} className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100 flex flex-col gap-2">
                            {/* A. Timestamp */}
                            <div className="text-xs text-zinc-400 font-medium">
                                {timestamp}
                            </div>

                            {/* B. Entry Text */}
                            <ExpandableMarkdown content={entry.text} />

                            {/* C. Attachments */}
                            {entry.attachments && entry.attachments.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {entry.attachments.map(att => {
                                        let src = '';
                                        if (att.blob) {
                                            src = URL.createObjectURL(att.blob);
                                        } else if (att.key) {
                                            src = `/api/files/${att.key}`;
                                        }

                                        if (att.type === 'image') {
                                            return (
                                                <div key={att.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-zinc-200">
                                                    {src ? (
                                                        <img src={src} alt="attachment" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-300">Loading...</div>
                                                    )}
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <a
                                                    key={att.id}
                                                    href={src || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="aspect-square rounded-lg bg-gray-50 border border-zinc-200 flex flex-col items-center justify-center p-2 text-center hover:bg-gray-100 transition-colors text-zinc-600 gap-1"
                                                >
                                                    <div className="p-2 bg-white rounded-full shadow-sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                    </div>
                                                    <span className="text-[10px] break-all line-clamp-2">{att.name || 'File'}</span>
                                                </a>
                                            );
                                        }
                                    })}
                                </div>
                            )}

                            {/* D. Sync Status Indicator */}
                            {entry.synced === 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="w-2 h-2 rounded-full border border-zinc-300"></div>
                                    <span className="text-[10px] text-zinc-400 font-medium">Saving…</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>
        </div>
    );
}
