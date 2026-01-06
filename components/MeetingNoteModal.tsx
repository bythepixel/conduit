import { useEffect, useRef } from 'react'

type MeetingNote = {
    id: number
    meetingId: string
    title?: string
    notes?: string
    transcriptUrl?: string
    summary?: string
    participants: string[]
    duration?: number
    meetingDate?: string
    metadata?: any
    hubspotCompanyId?: number
    hubspotCompany?: {
        id: number
        name: string
        btpAbbreviation?: string
    }
    syncedToHubspot: boolean
    createdAt: string
    updatedAt: string
}

type HubspotCompany = {
    id: number
    companyId: string
    name: string
    btpAbbreviation: string | null
}

type MeetingNoteModalProps = {
    isOpen: boolean
    onClose: () => void
    note: MeetingNote | null
    formatDuration: (minutes?: number) => string
    formatDate: (dateString?: string) => string
    companies?: HubspotCompany[]
    onLinkCompany?: (noteId: number, companyId: number | null) => Promise<void>
    linkingNote?: number | null
}

export default function MeetingNoteModal({ 
    isOpen, 
    onClose, 
    note, 
    formatDuration, 
    formatDate,
    companies = [],
    onLinkCompany,
    linkingNote = null
}: MeetingNoteModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)

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

    if (!isOpen || !note) return null

    const hasExternalParticipant = note.participants.some(p => 
        !p.toLowerCase().includes('bythepixel.com')
    )

    const findSuggestedCompany = (title?: string) => {
        if (!title || companies.length === 0) return null
        const firstWord = title.trim().split(/\s+/)[0].toLowerCase()
        if (!firstWord) return null
        return companies.find(c => c.btpAbbreviation?.toLowerCase() === firstWord)
    }

    const suggestedCompany = !note.hubspotCompany ? findSuggestedCompany(note.title) : null

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            onClick={onClose}
        >
            <div 
                ref={modalRef}
                className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold text-slate-100 mb-1">
                            {note.title || 'Untitled Meeting'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-slate-500 text-xs font-mono">{note.meetingId}</p>
                            {note.hubspotCompany ? (
                                <span className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 rounded text-xs font-bold">
                                    🏢 {note.hubspotCompany.name}
                                </span>
                            ) : suggestedCompany && onLinkCompany ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-500 italic">
                                        Suggest: {suggestedCompany.name}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onLinkCompany(note.id, suggestedCompany.id)
                                        }}
                                        disabled={linkingNote === note.id}
                                        className="px-2 py-0.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-600/30 rounded text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {linkingNote === note.id ? (
                                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                                Link
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-2 ml-4 flex-shrink-0"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {note.meetingDate && (
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                <span className="text-slate-300">{formatDate(note.meetingDate)}</span>
                            </div>
                        )}
                        {note.duration && (
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span className="text-slate-300">{formatDuration(note.duration)}</span>
                            </div>
                        )}
                    </div>

                    {/* Participants */}
                    {note.participants.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                Participants ({note.participants.length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {note.participants.map((p, i) => {
                                    const isByThePixel = p.toLowerCase().includes('bythepixel.com')
                                    return (
                                        <span 
                                            key={i} 
                                            className={`px-3 py-1.5 rounded ${
                                                isByThePixel 
                                                    ? 'bg-slate-700 text-slate-300' 
                                                    : 'bg-amber-700 text-amber-100'
                                            }`}
                                        >
                                            {p}
                                        </span>
                                    )
                                })}
                            </div>
                            {hasExternalParticipant && (
                                <p className="text-xs text-amber-400 mt-2">
                                    ⚠️ This meeting includes external participants
                                </p>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {note.summary && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Summary</h3>
                            <div className="bg-slate-900 rounded-lg p-4">
                                <p className="text-slate-200 whitespace-pre-wrap">{note.summary}</p>
                            </div>
                        </div>
                    )}

                    {/* Transcript URL */}
                    {note.transcriptUrl && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Transcript</h3>
                            <div className="bg-slate-900 rounded-lg p-4">
                                <a 
                                    href={note.transcriptUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    View transcript on Fireflies.ai
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {note.notes && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Notes</h3>
                            <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <p className="text-slate-200 whitespace-pre-wrap">{note.notes}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700 p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 text-slate-300 rounded-lg font-semibold hover:bg-slate-600 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

