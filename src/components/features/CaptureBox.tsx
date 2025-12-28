import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useCapture } from '@/contexts/CaptureContext';
import { useUndo } from '@/hooks/use-undo';
import { db } from '@/lib/db';
import { syncQueue } from '@/lib/sync';
import { Image, Paperclip, ArrowUp, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Attachment {
    id: string;
    type: 'image' | 'file';
    mimeType: string;
    name: string;
    blob?: File;
    synced: number;
}

export function CaptureBox() {
    const { isOpen, prefillText, metadata, closeCapture } = useCapture();
    const { showUndo } = useUndo();
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const createCapture = trpc.log.create.useMutation();

    // Reset text and attachments when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setText(prefillText);
            setAttachments([]);
            // Focus textarea after a brief delay
            const timer = setTimeout(() => {
                textareaRef.current?.focus();
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
                }
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setText('');
            setAttachments([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]); // Only depend on isOpen to avoid cascading renders

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newAtts: Attachment[] = Array.from(e.target.files).map(f => ({
                id: crypto.randomUUID(),
                type: f.type.startsWith('image/') ? 'image' : 'file',
                mimeType: f.type,
                name: f.name,
                blob: f,
                synced: 0
            }));
            setAttachments(prev => [...prev, ...newAtts]);
            if (e.target) e.target.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!text.trim() && attachments.length === 0) return;

        const entryId = crypto.randomUUID();
        const now = Date.now();

        try {
            // Save locally first
            await db.entries.add({
                id: entryId,
                created_at: now,
                text: text.trim(),
                attachments: attachments,
                synced: 0,
                rootId: entryId,
                parentId: undefined,
            });

            // Create capture with metadata if available
            await createCapture.mutateAsync({
                entryId,
                text: text.trim(),
                attachments: attachments,
                event_type: metadata?.event_type,
                linked_task_id: metadata?.linked_task_id,
                linked_commitment_id: metadata?.linked_commitment_id,
                event_payload: metadata?.event_payload,
            });

            // Show undo toast if this was an event-driven action
            if (metadata?.event_type) {
                showUndo(entryId);
            }

            syncQueue();
            closeCapture();
        } catch (error) {
            console.error("Capture failed", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={closeCapture}>
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                    <h2 className="text-lg font-semibold text-zinc-900">Capture</h2>
                    <button
                        onClick={closeCapture}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Textarea */}
                <div className="flex-1 overflow-y-auto p-4">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="What's on your mind?"
                        rows={4}
                        className="w-full bg-transparent text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 resize-none outline-none min-h-[120px]"
                        style={{ fontFeatureSettings: '"kern"', WebkitFontSmoothing: 'antialiased' }}
                    />
                </div>

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-zinc-50">
                        {attachments.map((att) => (
                            <div key={att.id} className="w-16 h-16 shrink-0 relative rounded-xl overflow-hidden border border-zinc-200/80 shadow-sm group/att bg-zinc-50">
                                {att.type === 'image' && att.blob ? (
                                    <img src={URL.createObjectURL(att.blob)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500 font-medium tracking-wide break-all p-1 text-center leading-tight">
                                        {att.name}
                                    </div>
                                )}
                                <button
                                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                    className="absolute top-1 right-1 w-5 h-5 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg flex items-center justify-center text-xs opacity-0 group-hover/att:opacity-100 transition-all hover:bg-zinc-900"
                                    aria-label="Remove attachment"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-1">
                        <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={handleFileSelect} />
                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

                        <button
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200 active:scale-95"
                            aria-label="Add image"
                        >
                            <Image className="w-5 h-5 stroke-[1.5]" />
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200 active:scale-95"
                            aria-label="Add file"
                        >
                            <Paperclip className="w-5 h-5 stroke-[1.5]" />
                        </button>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() && attachments.length === 0}
                        className="bg-zinc-900 text-white rounded-xl px-4 py-2 flex items-center gap-2 font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-zinc-800"
                    >
                        <span>Capture</span>
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

