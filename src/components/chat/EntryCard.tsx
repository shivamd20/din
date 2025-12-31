import React from 'react';
import { FileText, Calendar, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Entry {
    id: string;
    text: string;
    created_at: number;
    source: string;
    action_type: string | null;
    action_context: string | null;
    linked_task_id: string | null;
    linked_commitment_id: string | null;
    [key: string]: unknown;
}

interface EntryCardProps {
    entry: Entry;
}

export function EntryCard({ entry }: EntryCardProps) {
    const date = new Date(entry.created_at);
    const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    // Parse action_context if it's a string
    let actionContext: Record<string, unknown> | null = null;
    if (entry.action_context) {
        try {
            actionContext = typeof entry.action_context === 'string'
                ? JSON.parse(entry.action_context)
                : entry.action_context as Record<string, unknown>;
        } catch {
            // Invalid JSON, ignore
        }
    }

    return (
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-blue-100/50 shrink-0">
                    <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-zinc-900 leading-relaxed whitespace-pre-wrap">
                        {entry.text}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formattedDate}</span>
                </div>
                {entry.source && (
                    <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                            {entry.source}
                        </span>
                    </div>
                )}
                {entry.linked_task_id && (
                    <div className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Linked to task</span>
                    </div>
                )}
                {entry.linked_commitment_id && (
                    <div className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Linked to commitment</span>
                    </div>
                )}
                {entry.action_type && (
                    <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                            {entry.action_type}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

