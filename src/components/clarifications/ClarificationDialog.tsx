import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCapture } from '@/contexts/CaptureContext';

interface ClarificationField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    placeholder?: string;
}

interface ClarificationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    fields: ClarificationField[];
    onSubmit: (data: Record<string, string | number>) => void;
}

export function ClarificationDialog({ isOpen, onClose, title, fields, onSubmit }: ClarificationDialogProps) {
    const [formData, setFormData] = useState<Record<string, string | number>>({});

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        setFormData({});
        onClose();
    };

    const handleChange = (fieldId: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                    <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {fields.map(field => (
                        <div key={field.id}>
                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                                {field.label}
                            </label>
                            {field.type === 'select' && field.options ? (
                                <select
                                    value={formData[field.id]?.toString() || ''}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                                    required
                                >
                                    <option value="">Select...</option>
                                    {field.options.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type}
                                    value={formData[field.id]?.toString() || ''}
                                    onChange={(e) => handleChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                                    required
                                />
                            )}
                        </div>
                    ))}

                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
                        >
                            Skip
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            Submit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


