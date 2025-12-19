import Head from 'next/head'
import Header from '../../components/Header'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"

type FireHookLog = {
    id: number
    date: string
    meetingId?: string
    eventType: string
    clientReferenceId?: string
    payload?: any
    processed: boolean
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
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
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Reference</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Processed</th>
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
                                                        <div className="text-sm text-slate-300 font-mono">
                                                            {log.clientReferenceId || <span className="text-slate-500">N/A</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={getProcessedBadge(log.processed)}>
                                                            {log.processed ? 'Processed' : 'Pending'}
                                                        </span>
                                                        {log.errorMessage && (
                                                            <div className="text-xs text-red-400 mt-1 max-w-xs truncate" title={log.errorMessage}>
                                                                {log.errorMessage}
                                                            </div>
                                                        )}
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
                                                        <td colSpan={6} className="py-4 px-4 bg-slate-700/20">
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
        </div>
    )
}

