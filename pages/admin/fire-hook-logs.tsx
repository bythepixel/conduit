import Head from 'next/head'
import Header from '../../components/Header'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { Play, Trash2, CheckCircle, XCircle, Info, AlertTriangle, Loader2 } from 'lucide-react'
import ErrorModal from '../../components/ErrorModal'

type FireHookLog = {
    id: number
    date: string
    meetingId?: string
    eventType: string
    clientReferenceId?: string
    payload?: any
    processed: boolean
    isAuthentic?: boolean | null
    computedSignature?: string | null
    receivedSignature?: string | null
    errorMessage?: string
    createdAt: string
    updatedAt: string
}

export default function FireHookLogs() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [logs, setLogs] = useState<FireHookLog[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
    const [total, setTotal] = useState(0)
    const [limit] = useState(50)
    const [offset, setOffset] = useState(0)
    const [processingLogs, setProcessingLogs] = useState<Set<number>>(new Set())
    const [deletingLogId, setDeletingLogId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'error' | 'success' | 'info' | undefined;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    })

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchLogs()
        }
    }, [status, offset])

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/fire-hook-logs?limit=${limit}&offset=${offset}`)
            if (res.ok) {
                const data = await res.json()
                if (data.logs) {
                    setLogs(data.logs)
                    setTotal(data.total || 0)
                } else {
                    setLogs([])
                    setTotal(0)
                }
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
                console.error('Failed to fetch fire hook logs:', res.status, res.statusText, errorData)
            }
        } catch (error: any) {
            console.error('Error fetching fire hook logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpand = (logId: number) => {
        const newExpanded = new Set(expandedLogs)
        if (newExpanded.has(logId)) {
            newExpanded.delete(logId)
        } else {
            newExpanded.add(logId)
        }
        setExpandedLogs(newExpanded)
    }

    const handleProcess = async (logId: number, e: React.MouseEvent) => {
        e.stopPropagation() // Prevent row expansion

        if (processingLogs.has(logId)) {
            return // Already processing
        }

        setProcessingLogs(prev => new Set(prev).add(logId))

        try {
            const res = await fetch(`/api/fire-hook-logs/${logId}/process`, {
                method: 'POST',
            })

            const data = await res.json().catch(() => ({ error: 'Failed to parse response' }))

            if (!res.ok) {
                console.error('Failed to process fire hook log:', res.status, data)
                const errorMsg = data.details
                    ? `${data.error}: ${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}`
                    : data.error || 'Unknown error'
                alert(`Failed to process log: ${errorMsg}`)
            } else {
                // Refresh the logs to show updated status
                await fetchLogs()
            }
        } catch (error: any) {
            console.error('Error processing fire hook log:', error)
            alert(`Error processing log: ${error.message || 'Network error'}`)
        } finally {
            setProcessingLogs(prev => {
                const newSet = new Set(prev)
                newSet.delete(logId)
                return newSet
            })
        }
    }

    const handleDelete = async (logId: number) => {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/fire-hook-logs/${logId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                setModalConfig({
                    isOpen: true,
                    title: 'Success',
                    message: 'Fire hook log deleted successfully',
                    type: 'success'
                })
                fetchLogs()
            } else {
                const data = await res.json().catch(() => ({ error: 'Unknown error' }))
                setModalConfig({
                    isOpen: true,
                    title: 'Error',
                    message: data.error || 'Failed to delete fire hook log',
                    type: 'error'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                title: 'Error',
                message: error.message || 'An error occurred while deleting the log',
                type: 'error'
            })
        } finally {
            setIsDeleting(false)
            setDeletingLogId(null)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const pad = (n: number) => n.toString().padStart(2, '0')

        const month = pad(date.getMonth() + 1)
        const day = pad(date.getDate())
        const year = date.getFullYear().toString().slice(-2)
        const hours = pad(date.getHours())
        const minutes = pad(date.getMinutes())

        return `${month}/${day}/${year} ${hours}:${minutes}`
    }

    const getEventTypeBadge = (eventType: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold"
        switch (eventType.toLowerCase()) {
            case 'transcript_completed':
            case 'summary_ready':
                return `${baseClasses} bg-green-500/20 text-green-400`
            case 'error':
            case 'failed':
                return `${baseClasses} bg-red-500/20 text-red-400`
            default:
                return `${baseClasses} bg-blue-500/20 text-blue-400`
        }
    }

    const getProcessedBadge = (processed: boolean) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold"
        if (processed) {
            return `${baseClasses} bg-green-500/20 text-green-400`
        } else {
            return `${baseClasses} bg-yellow-500/20 text-yellow-400`
        }
    }

    const getAuthenticBadge = (isAuthentic: boolean | null | undefined) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold"
        if (isAuthentic === true) {
            return `${baseClasses} bg-green-500/20 text-green-400`
        } else if (isAuthentic === false) {
            return `${baseClasses} bg-red-500/20 text-red-400`
        } else {
            return `${baseClasses} bg-slate-500/20 text-slate-400`
        }
    }

    if (status === "loading") {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center">Loading...</div>
    }

    if (!session) {
        return null // Will redirect
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <Head>
                <title>Fire Hook Logs - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-100">Fire Hook Logs</h2>
                        {total > 0 && (
                            <div className="text-sm text-slate-400">
                                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Loading fire hook logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-slate-400 mb-2">No fire hook logs found</div>
                            <div className="text-xs text-slate-500">
                                Fire hook logs are created automatically when webhooks are received from Fireflies.ai.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Type</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Meeting ID</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Authentic</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Processed</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <>
                                                <tr
                                                    key={log.id}
                                                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                                                    onClick={() => toggleExpand(log.id)}
                                                >
                                                    <td className="py-4 px-4">
                                                        <div className="text-sm text-slate-200">{formatDate(log.date)}</div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={getEventTypeBadge(log.eventType)}>{log.eventType}</span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="text-sm text-slate-300 font-mono">
                                                            {log.meetingId || <span className="text-slate-500">N/A</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={getAuthenticBadge(log.isAuthentic)}>
                                                            {log.isAuthentic === true ? '✓ Authentic' : log.isAuthentic === false ? '✗ Inauthentic' : '? Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={getProcessedBadge(log.processed)}>
                                                            {log.processed ? 'Processed' : 'Pending'}
                                                        </span>
                                                        {log.errorMessage && (
                                                            <div className="mt-1">
                                                                <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider border border-red-500/30">
                                                                    Error
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-2">
                                                            {!log.processed && log.meetingId && (
                                                                <button
                                                                    onClick={(e) => handleProcess(log.id, e)}
                                                                    disabled={processingLogs.has(log.id)}
                                                                    className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                                    title="Process Log"
                                                                >
                                                                    {processingLogs.has(log.id) ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Play className="h-4 w-4 fill-current" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setDeletingLogId(log.id)
                                                                }}
                                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                                                title="Delete Log"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <button className="text-slate-400 hover:text-slate-200 transition-colors">
                                                            {expandedLogs.has(log.id) ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="18 15 12 9 6 15"></polyline>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandedLogs.has(log.id) && (
                                                    <tr key={`${log.id}-details`}>
                                                        <td colSpan={7} className="py-4 px-4 bg-slate-700/20">
                                                            <div className="space-y-3">
                                                                <h4 className="text-sm font-semibold text-slate-300 mb-3">Details:</h4>
                                                                <div className="space-y-2 text-xs text-slate-400">
                                                                    {log.meetingId && (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-300">Meeting ID:</span> {log.meetingId}
                                                                        </div>
                                                                    )}
                                                                    {log.clientReferenceId && (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-300">Client Reference ID:</span> {log.clientReferenceId}
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <span className="font-semibold text-slate-300">Event Type:</span> {log.eventType}
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-slate-300">Authentic:</span> {
                                                                            log.isAuthentic === true ? '✓ Yes' :
                                                                                log.isAuthentic === false ? '✗ No' :
                                                                                    '? Unknown'
                                                                        }
                                                                    </div>
                                                                    {log.computedSignature && (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-300">Computed Signature:</span>
                                                                            <div className="mt-1 font-mono text-xs break-all text-slate-300">
                                                                                {log.computedSignature}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {log.receivedSignature && (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-300">Received Signature:</span>
                                                                            <div className="mt-1 font-mono text-xs break-all text-slate-300">
                                                                                {log.receivedSignature}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <span className="font-semibold text-slate-300">Processed:</span> {log.processed ? 'Yes' : 'No'}
                                                                    </div>
                                                                    {log.errorMessage && (
                                                                        <div className="text-red-400">
                                                                            <span className="font-semibold">Error:</span> {log.errorMessage}
                                                                        </div>
                                                                    )}
                                                                    {log.payload && (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-300">Payload:</span>
                                                                            <pre className="mt-2 p-3 bg-slate-900 rounded-lg overflow-x-auto text-xs">
                                                                                {JSON.stringify(log.payload, null, 2)}
                                                                            </pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-700">
                                <button
                                    onClick={() => setOffset(Math.max(0, offset - limit))}
                                    disabled={offset === 0}
                                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                                >
                                    Previous
                                </button>
                                <div className="text-sm text-slate-400">
                                    Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
                                </div>
                                <button
                                    onClick={() => setOffset(offset + limit)}
                                    disabled={offset + limit >= total}
                                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingLogId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
                        <div className="flex items-center gap-4 text-red-400 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-100">Delete Fire Hook Log?</h3>
                        </div>
                        <p className="text-slate-400 mb-8">
                            Are you sure you want to delete this fire hook log? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingLogId(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deletingLogId)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ErrorModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
            />
        </div>
    )
}

