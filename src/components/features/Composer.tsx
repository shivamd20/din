import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { db } from '@/lib/db';
import { getMicrocopy } from '@/lib/microcopy';
import { syncQueue } from '@/lib/sync';
import { Image, Paperclip } from 'lucide-react';

interface ComposerProps {
    onCapture?: () => void;
}

interface Attachment {
    id: string;
    type: 'image' | 'file';
    mimeType: string;
    name: string;
    blob?: File;
    synced: number;
}

export function Composer({ onCapture }: ComposerProps) {
    const [text, setText] = useState(() => {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('din-draft') || '';
        }
        return '';
    });

    // Drafts: Autosave
    useEffect(() => {
        localStorage.setItem('din-draft', text);
    }, [text]);

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'file') => {
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
            await db.entries.add({
                id: entryId,
                created_at: now,
                text: text.trim(),
                attachments: attachments,
                synced: 0,
                rootId: entryId,
                parentId: undefined,
            });

            setText('');
            setAttachments([]);
            localStorage.removeItem('din-draft');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            syncQueue();
            if (onCapture) onCapture();

        } catch (error) {
            console.error("Capture failed locally", error);
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    return (
        <div className="flex flex-col flex-1 h-full bg-white relative">
            {/* Editor Area - Centered Vertical */}
            <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">
                <div className="w-full max-w-xl mx-auto py-8">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="What's on your mind?"
                        autoFocus
                        rows={1}
                        className="w-full bg-transparent text-lg leading-relaxed text-zinc-900 placeholder:text-zinc-300 resize-none outline-none min-h-[200px] max-h-[60vh] overflow-y-auto"
                        style={{ fontFeatureSettings: '"kern"', WebkitFontSmoothing: 'antialiased' }}
                    />
                </div>
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-zinc-50 bg-zinc-50/30">
                    {attachments.map((att) => (
                        <div key={att.id} className="w-16 h-16 shrink-0 relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm group">
                            {att.type === 'image' && att.blob ? (
                                <img src={URL.createObjectURL(att.blob)} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white flex items-center justify-center text-[10px] text-zinc-500 font-medium tracking-tight truncate px-1">{att.name}</div>
                            )}
                            <button
                                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                className="absolute top-0 right-0 p-0.5 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-1">
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />

                    <button onClick={() => imageInputRef.current?.click()} className="p-2.5 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all">
                        <Image className="w-5 h-5" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all">
                        <Paperclip className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!text.trim() && attachments.length === 0}
                    className="bg-zinc-900 text-white rounded-full h-10 px-5 flex items-center gap-2 font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-zinc-900/10 hover:shadow-zinc-900/20"
                >
                    <span>Capture</span>
                    {/* <SendHorizontal className="w-3.5 h-3.5" /> */}
                </button>
            </div>
        </div>
    );
}
