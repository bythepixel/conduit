import { useEffect, useRef } from 'react'

type ErrorModalProps = {
    isOpen: boolean
    onClose: () => void
    title?: string
    message: string
    type?: 'error' | 'success' | 'info'
}

export default function ErrorModal({ isOpen, onClose, title, message, type = 'error' }: ErrorModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLTextAreaElement>(null)

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    // Focus textarea when modal opens for easy selection
    useEffect(() => {
        if (isOpen && textRef.current) {
            textRef.current.focus()
            textRef.current.select()
        }
    }, [isOpen])

    const handleCopy = async () => {
        if (textRef.current) {
            try {
                await navigator.clipboard.writeText(textRef.current.value)
                // Visual feedback - could enhance with toast notification
            } catch (err) {
                // Fallback for older browsers
                textRef.current.select()
                document.execCommand('copy')
            }
        }
    }

    if (!isOpen) return null

    const iconColors = {
        error: 'bg-red-100 text-red-600',
        success: 'bg-green-100 text-green-600',
        info: 'bg-blue-100 text-blue-600'
    }

    const titleColors = {
        error: 'text-red-400',
        success: 'text-green-400',
        info: 'text-blue-400'
    }

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" 
            onClick={onClose}
        >
            <div 
                ref={modalRef}
                className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] flex flex-col" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full ${iconColors[type]} flex items-center justify-center flex-shrink-0`}>
                            {type === 'error' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            )}
                            {type === 'success' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            )}
                            {type === 'info' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            )}
                        </div>
                        <div>
                            <h3 className={`text-xl font-bold ${titleColors[type]}`}>
                                {title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Information')}
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-400">Message:</label>
                        <button
                            onClick={handleCopy}
                            className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                        </button>
                    </div>
                    <textarea
                        ref={textRef}
                        readOnly
                        value={message}
                        className="flex-1 w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{ minHeight: '200px' }}
                    />
                </div>
                
                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

