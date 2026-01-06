import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'
import MeetingNoteModal from '../../components/MeetingNoteModal'

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
    createdAt: string
    updatedAt: string
}

export default function MeetingNotes() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [notes, setNotes] = useState<MeetingNote[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [fetchingNotes, setFetchingNotes] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string; type?: 'error' | 'success' | 'info' }>({
        isOpen: false,
        message: '',
        type: 'error'
    })
    const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null)
    const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set())

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchNotes()
        }
    }, [status])

    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/meeting-notes')
            if (res.ok) {
                const data = await res.json()
                setNotes(data)
            } else {
                console.error('Failed to fetch notes:', res.status, res.statusText)
            }
        } catch (error: any) {
            console.error('Error fetching notes:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            const res = await fetch('/api/meeting-notes/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                const errorCount = data.results.errors?.length || 0
                let message = `Sync completed!\nCreated: ${data.results.created}\nUpdated: ${data.results.updated}`
                if (errorCount > 0) {
                    message += `\n\nErrors: ${errorCount}`
                    if (errorCount <= 10) {
                        message += '\n\n' + data.results.errors.join('\n')
                    } else {
                        message += `\n\nFirst 10 errors:\n${data.results.errors.slice(0, 10).join('\n')}\n\n... and ${errorCount - 10} more`
                    }
                }
                setErrorModal({
                    isOpen: true,
                    message: message,
                    type: errorCount > 0 ? 'info' : 'success'
                })
                await fetchNotes()
            } else {
                const errorMessage = data.error || data.details?.message || 'Failed to sync meeting notes'
                const fullMessage = data.details
                    ? `${errorMessage}\n\nDetails:\n${JSON.stringify(data.details, null, 2)}`
                    : errorMessage
                setErrorModal({
                    isOpen: true,
                    message: fullMessage,
                    type: 'error'
                })
            }
        } catch (error: any) {
            setErrorModal({
                isOpen: true,
                message: 'An error occurred: ' + (error.message || 'Unknown error'),
                type: 'error'
            })
        } finally {
            setSyncing(false)
        }
    }

    const handleFetchMeetingNotes = async (meetingId: string) => {
        if (fetchingNotes.has(meetingId)) return

        setFetchingNotes(prev => new Set(prev).add(meetingId))
        try {
            const res = await fetch(`/api/meeting-notes/${meetingId}/fetch`, {
                method: 'POST'
            })
            const data = await res.json()

            if (res.ok) {
                // Update the local state for this specific note
                setNotes(prevNotes => prevNotes.map(n =>
                    n.meetingId === meetingId ? { ...n, ...data.note } : n
                ))
            } else {
                setErrorModal({
                    isOpen: true,
                    message: data.error || 'Failed to fetch meeting notes',
                    type: 'error'
                })
            }
        } catch (error: any) {
            setErrorModal({
                isOpen: true,
                message: 'An error occurred while fetching notes: ' + error.message,
                type: 'error'
            })
        } finally {
            setFetchingNotes(prev => {
                const newSet = new Set(prev)
                newSet.delete(meetingId)
                return newSet
            })
        }
    }

    const formatDuration = (minutes?: number) => {
        if (!minutes) return 'N/A'
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        if (hours > 0) {
            return `${hours}h ${mins}m`
        } else {
            return `${mins}m`
        }
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A'
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return dateString
        }
    }

    if (status === "loading" || !session) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Head>
                <title>Meeting Notes - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <span>📝</span> Meeting Notes
                </h1>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-slate-800 rounded-lg shadow-sm" />)}
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500">
                        No meeting notes found. Sync from Fireflies.ai to get started!
                    </div>
                ) : (() => {
                    // Filter notes by search
                    const filteredNotes = notes.filter(note => {
                        if (!search.trim()) return true
                        const searchLower = search.toLowerCase()
                        const title = note.title?.toLowerCase() || ''
                        const meetingId = note.meetingId.toLowerCase()
                        const participants = note.participants.join(' ').toLowerCase()
                        const summary = note.summary?.toLowerCase() || ''
                        return title.includes(searchLower) ||
                            meetingId.includes(searchLower) ||
                            participants.includes(searchLower) ||
                            summary.includes(searchLower)
                    })

                    // Group meetings by whether they have external participants
                    const clientMeetings = filteredNotes.filter(note => {
                        return note.participants.some(p => !p.toLowerCase().includes('bythepixel.com'))
                    })
                    const internalMeetings = filteredNotes.filter(note => {
                        return note.participants.every(p => p.toLowerCase().includes('bythepixel.com'))
                    })

                    const renderNoteCard = (note: MeetingNote) => {
                        const hasExternalParticipant = note.participants.some(p =>
                            !p.toLowerCase().includes('bythepixel.com')
                        )
                        return (
                            <div
                                key={note.id}
                                className={`p-4 rounded-lg shadow-sm border hover:shadow-md transition-all ${hasExternalParticipant
                                    ? 'bg-amber-900/30 border-amber-700/50'
                                    : 'bg-slate-800 border-slate-700'
                                    }`}
                            >
                                <div className="mb-3">
                                    <h3 className="font-semibold text-slate-100 text-lg mb-1 line-clamp-2">
                                        {note.title || 'Untitled Meeting'}
                                    </h3>
                                    <p className="text-slate-500 text-xs font-mono mb-2">{note.meetingId}</p>
                                </div>

                                {note.summary && (() => {
                                    // Extract keywords from summary if present
                                    const summaryParts = note.summary.split('\n\n')
                                    const keywordsPart = summaryParts.find(part => part.startsWith('Keywords:'))
                                    const otherParts = summaryParts.filter(part => !part.startsWith('Keywords:'))
                                    const otherSummary = otherParts.length > 0 ? otherParts.join('\n\n') : null

                                    return (
                                        <div className="mb-3">
                                            {keywordsPart && (
                                                <div className="mb-2">
                                                    <p className="text-slate-300 text-xs line-clamp-2">{keywordsPart}</p>
                                                </div>
                                            )}
                                            {otherSummary && (
                                                <p className="text-slate-300 text-sm line-clamp-3">{otherSummary}</p>
                                            )}
                                        </div>
                                    )
                                })()}

                                <div className="space-y-2 text-xs text-slate-400">
                                    {note.meetingDate && (
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                                <line x1="3" y1="10" x2="21" y2="10"></line>
                                            </svg>
                                            <span>{formatDate(note.meetingDate)}</span>
                                        </div>
                                    )}

                                    {note.duration && (
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polyline points="12 6 12 12 16 14"></polyline>
                                            </svg>
                                            <span>{formatDuration(note.duration)}</span>
                                        </div>
                                    )}

                                    {note.participants.length > 0 && (
                                        <div className="flex items-start gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                            </svg>
                                            <div className="flex-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        const newExpanded = new Set(expandedParticipants)
                                                        if (newExpanded.has(note.id)) {
                                                            newExpanded.delete(note.id)
                                                        } else {
                                                            newExpanded.add(note.id)
                                                        }
                                                        setExpandedParticipants(newExpanded)
                                                    }}
                                                    className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                                                >
                                                    {note.participants.length} participant{note.participants.length !== 1 ? 's' : ''}
                                                    <span className="ml-1 text-xs">
                                                        {expandedParticipants.has(note.id) ? '▼' : '▶'}
                                                    </span>
                                                </button>
                                                {expandedParticipants.has(note.id) && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {note.participants.map((p, i) => {
                                                            const isByThePixel = p.toLowerCase().includes('bythepixel.com')
                                                            return (
                                                                <span
                                                                    key={i}
                                                                    className={`px-2 py-0.5 rounded ${isByThePixel
                                                                        ? 'bg-slate-700 text-slate-300'
                                                                        : 'bg-amber-700 text-amber-100'
                                                                        }`}
                                                                >
                                                                    {p}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {note.notes && (
                                    <div className="mt-3 pt-3 border-t border-slate-700">
                                        <p className="text-slate-500 text-xs">
                                            <span className="font-semibold text-slate-400">Notes: </span>
                                            {note.notes.length > 100
                                                ? `${note.notes.substring(0, 100)}...`
                                                : note.notes}
                                        </p>
                                    </div>
                                )}

                                <div className="mt-4 pt-3 border-t border-slate-700 space-y-2">
                                    {!note.notes && (
                                        <button
                                            onClick={() => handleFetchMeetingNotes(note.meetingId)}
                                            disabled={fetchingNotes.has(note.meetingId)}
                                            className={`w-full px-4 py-2 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-2 ${fetchingNotes.has(note.meetingId)
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-emerald-900/20'
                                                }`}
                                        >
                                            {fetchingNotes.has(note.meetingId) ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-emerald-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Fetching...
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                    Fetch Notes
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedNote(note)}
                                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        View Full Details
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    if (clientMeetings.length === 0 && internalMeetings.length === 0) {
                        return (
                            <div className="text-center py-12 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500">
                                No notes match "{search}"
                            </div>
                        )
                    }

                    return (
                        <div className="space-y-6">
                            {/* Client Meetings */}
                            {clientMeetings.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                                            <span>🤝</span> Client Meetings
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                placeholder="Search notes..."
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-48"
                                            />
                                            <button
                                                onClick={handleSync}
                                                disabled={syncing}
                                                className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${syncing
                                                    ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                                                    }`}
                                                title="Sync all meeting notes from Fireflies.ai"
                                            >
                                                {syncing ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span className="text-sm">Syncing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="23 4 23 10 17 10"></polyline>
                                                            <polyline points="1 20 1 14 7 14"></polyline>
                                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                                        </svg>
                                                        <span className="text-sm">Sync</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {clientMeetings.map(renderNoteCard)}
                                    </div>
                                </div>
                            )}

                            {/* Internal Meetings */}
                            {internalMeetings.length > 0 && (
                                <div>
                                    <h3 className="text-md font-bold text-slate-200 mb-3 flex items-center gap-2">
                                        <span>🏢</span> Internal Meetings
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {internalMeetings.map(renderNoteCard)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div>

            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ isOpen: false, message: '' })}
                message={errorModal.message}
                type={errorModal.type}
            />

            <MeetingNoteModal
                isOpen={selectedNote !== null}
                onClose={() => setSelectedNote(null)}
                note={selectedNote}
                formatDuration={formatDuration}
                formatDate={formatDate}
            />
        </div>
    )
}

