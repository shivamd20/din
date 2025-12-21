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
    "What’s on your mind?",
    "Capture a thought...",
    "What needs to get done?"
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
        <div className="flex flex-col w-full bg-white relative pt-8 pb-4 transition-all duration-300 ease-in-out font-sans group">

            {/* Plain Textarea - Apple-like typography */}
            <div className="px-6 relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    rows={1}
                    className="w-full bg-transparent text-xl leading-relaxed text-zinc-900 placeholder:text-zinc-300 resize-none outline-none font-medium tracking-tight py-2 min-h-[60px] max-h-[60vh] overflow-y-auto"
                    style={{ fontFeatureSettings: '"kern"', WebkitFontSmoothing: 'antialiased' }}
                />
            </div>

            {/* Attachments Preview - Refined */}
            {attachments.length > 0 && (
                <div className="flex gap-3 overflow-x-auto px-6 py-4 scrollbar-hide">
                    {attachments.map((att) => (
                        <div key={att.id} className="w-16 h-16 shrink-0 relative rounded-xl overflow-hidden border border-zinc-100 shadow-sm group/att bg-zinc-50">
                            {att.type === 'image' && att.blob ? (
                                <img src={URL.createObjectURL(att.blob)} className="w-full h-full object-cover opacity-90 transition-opacity group-hover/att:opacity-100" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-400 font-medium tracking-wide break-all p-1 text-center leading-tight">
                                    {att.name}
                                </div>
                            )}
                            <button
                                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover/att:opacity-100 transition-all hover:bg-black/80"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Controls Row - Minimalist, fades in when needed or hovered */}
            <div className="flex items-center justify-between px-6 mt-2 opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2 -ml-2">
                    <button
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all duration-200 active:scale-95"
                    >
                        <Image className="w-5 h-5 stroke-[1.5]" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all duration-200 active:scale-95"
                    >
                        <Paperclip className="w-5 h-5 stroke-[1.5]" />
                    </button>
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />
                </div>

                <div className="flex items-center gap-4">
                    {/* Microcopy only shows when empty to encourage, or hidden when typing to focus */}
                    {!text && attachments.length === 0 && (
                        <span className="text-[13px] text-zinc-300 font-medium tracking-wide">
                            Saved instantly
                        </span>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() && attachments.length === 0}
                        className="bg-black text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-0 disabled:translate-y-2 transition-all duration-300 active:scale-90 shadow-md shadow-zinc-200 hover:shadow-lg hover:shadow-zinc-300 hover:-translate-y-0.5"
                    >
                        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
