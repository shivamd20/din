import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { db } from '@/lib/db';
import { syncQueue } from '@/lib/sync';
import { Image, Paperclip, ArrowUp, X } from 'lucide-react';

interface CaptureZoneProps {
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

const PLACEHOLDERS = [
    "What's on your mind?",
    "Capture a thought...",
    "What needs attention?"
];

export function CaptureZone({ onCapture }: CaptureZoneProps) {
    const [text, setText] = useState(() => {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('din-draft') || '';
        }
        return '';
    });

    const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (text === '') {
            setPlaceholder(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
        }
    }, [text]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset to auto to get correct scrollHeight
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

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
            if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
            syncQueue();
            if (onCapture) onCapture();

        } catch (error) {
            console.error("Capture failed locally", error);
        }
    };

    return (
        <div className="flex flex-col w-full bg-white relative pt-2 pb-4 transition-all duration-300 ease-in-out font-sans group">

            {/* Plain Textarea - Clean, focused typography */}
            <div className="px-6 relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    rows={1}
                    className="w-full bg-transparent text-xl leading-relaxed text-zinc-900 placeholder:text-zinc-400 resize-none outline-none font-medium tracking-tight py-3 min-h-[64px] max-h-[60vh] overflow-y-auto"
                    style={{ fontFeatureSettings: '"kern"', WebkitFontSmoothing: 'antialiased' }}
                />
            </div>

            {/* Attachments Preview - Clean */}
            {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-6 py-3 scrollbar-hide">
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

            {/* Controls Row - Minimalist, clean */}
            <div className="flex items-center justify-between px-6 mt-1 opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-1 -ml-2">
                    <button
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all duration-200 active:scale-95"
                        aria-label="Add image"
                    >
                        <Image className="w-5 h-5 stroke-[1.5]" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all duration-200 active:scale-95"
                        aria-label="Add file"
                    >
                        <Paperclip className="w-5 h-5 stroke-[1.5]" />
                    </button>
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />
                </div>

                <div className="flex items-center gap-3">
                    {/* Microcopy only shows when empty to encourage */}
                    {!text && attachments.length === 0 && (
                        <span className="text-[12px] text-zinc-400 font-medium tracking-wide">
                            Saved instantly
                        </span>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() && attachments.length === 0}
                        className="bg-zinc-900 text-white rounded-xl w-10 h-10 flex items-center justify-center disabled:opacity-0 disabled:translate-y-2 transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md hover:bg-zinc-800"
                        aria-label="Submit"
                    >
                        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
