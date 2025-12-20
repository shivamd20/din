import React, { useState, useRef, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableMarkdownProps {
    content: string;
}

export function ExpandableMarkdown({ content }: ExpandableMarkdownProps) {
    const [expanded, setExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Check if content exceeds our max height (200px)
            // We add a small buffer (e.g. 10px) to avoid showing button for barely overflowing text
            setIsOverflowing(contentRef.current.scrollHeight > 210);
        }
    }, [content]);

    return (
        <div className="w-full flex flex-col relative" data-color-mode="light">
            <style>{`
                /* Fix broken text selection */
                .wmde-markdown ::selection,
                .wmde-markdown *::selection {
                  background-color: #bfdbfe !important;
                  color: #1f2937 !important;
                  -webkit-text-fill-color: #1f2937 !important;
                }
            `}</style>
            <div
                ref={contentRef}
                className={`
          w-full
          transition-all duration-300 ease-in-out
          ${!expanded ? 'max-h-[200px] overflow-hidden' : ''}
        `}
            >
                <MDEditor.Markdown
                    source={content}
                    style={{
                        backgroundColor: 'transparent',
                        color: '#27272a',
                        fontSize: '16px',
                        lineHeight: '1.625'
                    }}
                />
            </div>

            {/* Gradient Fade for collapsed state */}
            {!expanded && isOverflowing && (
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
            )}

            {/* Toggle Button */}
            {isOverflowing && (
                <div className={`flex w-full pt-2 ${expanded ? 'justify-end' : 'justify-center relative z-10 -mt-6'}`}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className={`
                  flex items-center gap-1.5 px-4 py-1.5 rounded-full 
                  transition-all shadow-sm border border-zinc-200
                  ${expanded
                                ? 'bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
                                : 'bg-white hover:bg-zinc-50 text-blue-600 hover:text-blue-700 shadow-md ring-4 ring-white/50'
                            }
                  text-xs font-medium
               `}
                    >
                        {expanded ? 'Show Less' : 'Read More'}
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                </div>
            )}
        </div>
    );
}
