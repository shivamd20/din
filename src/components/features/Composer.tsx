import React, { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';
// import { uuidv4 } from '@/lib/utils';
import { db } from '@/lib/db';
import { getMicrocopy } from '@/lib/microcopy';
import { syncQueue } from '@/lib/sync';
import { Image, Paperclip, SendHorizontal } from 'lucide-react';

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
            syncQueue();
            if (onCapture) onCapture();

        } catch (error) {
            console.error("Capture failed locally", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <style>{`
                .w-md-editor-toolbar { display: none !important; }
                .w-md-editor { box-shadow: none !important; border: none !important; }
                .w-md-editor-content { background: transparent !important; }
                .w-md-editor-text-pre, .w-md-editor-text-input { font-family: inherit !important; font-size: 1.125rem !important; line-height: 1.75rem !important; }
            `}</style>

            {/* Editor Area */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-center max-w-2xl mx-auto w-full">
                <MDEditor
                    value={text}
                    onChange={(val?: string) => setText(val || '')}
                    preview="edit"
                    visibleDragbar={false}
                    height="100%"
                    className="w-full bg-transparent !h-auto min-h-[50%]"
                    textareaProps={{
                        placeholder: "What's happening?",
                        autoFocus: true,
                        className: "text-lg leading-relaxed text-zinc-700 placeholder:text-zinc-300"
                    }}
                />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-2 border-t border-zinc-50">
                    {attachments.map((att) => (
                        <div key={att.id} className="w-16 h-16 shrink-0 relative rounded-lg overflow-hidden border border-zinc-200">
                            {att.type === 'image' && att.blob ? (
                                <img src={URL.createObjectURL(att.blob)} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-zinc-50 flex items-center justify-center text-[10px] text-zinc-500">{att.type}</div>
                            )}
                            <button
                                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                className="absolute top-0 right-0 p-0.5 bg-black/50 text-white"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-t border-zinc-100 bg-white/50 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />

                    <button onClick={() => imageInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors">
                        <Image className="w-6 h-6" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors">
                        <Paperclip className="w-6 h-6" />
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!text.trim() && attachments.length === 0}
                    className="bg-zinc-900 text-white rounded-full p-3 pl-5 pr-5 flex items-center gap-2 font-medium disabled:opacity-50 transition-all active:scale-95"
                >
                    <span>Capture</span>
                    <SendHorizontal className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
