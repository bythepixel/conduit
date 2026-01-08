import Head from 'next/head'
import Header from '../../components/Header'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"

type HarvestInvoiceCronLogInvoice = {
    id: number
    invoiceId: number
    status: 'success' | 'failed' | 'skipped'
    errorMessage?: string
    invoice: {
        id: number
        harvestId: string
        number?: string
        clientName?: string
        amount?: number
        currency?: string
    }
}

type HarvestInvoiceCronLog = {
    id: number
    startedAt: string
    completedAt?: string
    status: 'running' | 'completed' | 'failed'
    invoicesFound: number
    invoicesCreated: number
    invoicesUpdated: number
    invoicesFailed: number
    errorMessage?: string
    errors: string[]
    invoiceLogs: HarvestInvoiceCronLogInvoice[]
}

export default function HarvestInvoiceCronLogs() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [logs, setLogs] = useState<HarvestInvoiceCronLog[]>([])
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
            const res = await fetch(`/api/harvest-invoice-cron-logs?limit=${limit}&offset=${offset}`)
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
                console.error('Failed to fetch Harvest invoice cron logs:', res.status, res.statusText, errorData)
            }
        } catch (error: any) {
            console.error('Error fetching Harvest invoice cron logs:', error)
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

    const formatDuration = (startedAt: string, completedAt?: string) => {
        if (!completedAt) return 'Running...'
        const start = new Date(startedAt).getTime()
        const end = new Date(completedAt).getTime()
        const seconds = Math.floor((end - start) / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}m ${remainingSeconds}s`
    }

    const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined): string => {
        if (amount === null || amount === undefined) return 'N/A'
        const currencyCode = currency || 'USD'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode
        }).format(amount)
    }

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold"
        switch (status) {
            case 'completed':
                return `${baseClasses} bg-green-500/20 text-green-400`
            case 'failed':
                return `${baseClasses} bg-red-500/20 text-red-400`
            case 'running':
                return `${baseClasses} bg-yellow-500/20 text-yellow-400`
            default:
                return `${baseClasses} bg-slate-500/20 text-slate-400`
        }
    }

    const getInvoiceStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-0.5 rounded text-xs font-semibold"
        switch (status) {
            case 'success':
                return `${baseClasses} bg-green-500/20 text-green-400`
            case 'failed':
                return `${baseClasses} bg-red-500/20 text-red-400`
            case 'skipped':
                return `${baseClasses} bg-slate-500/20 text-slate-400`
            default:
                return `${baseClasses} bg-slate-500/20 text-slate-400`
        }
    }

    if (status === "loading") {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">Loading...</div>
    }

    if (!session) {
        return null // Will redirect
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <Head>
                <title>Harvest Invoice Cron Logs - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-100">Harvest Invoice Cron Logs</h2>
                        {total > 0 && (
                            <div className="text-sm text-slate-400">
                                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Loading cron logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-slate-400 mb-2">No cron logs found</div>
                            <div className="text-xs text-slate-500">
                                Cron logs are created automatically when the Harvest invoice sync runs via scheduled cron jobs.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-700">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Started</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoices</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration</th>
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
                                                        <div className="text-sm text-slate-200">{formatDate(log.startedAt)}</div>
                                                        {log.completedAt && (
                                                            <div className="text-xs text-slate-500 mt-1">Completed: {formatDate(log.completedAt)}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={getStatusBadge(log.status)}>{log.status}</span>
                                                        {log.errorMessage && (
                                                            <div className="text-xs text-red-400 mt-1 max-w-xs truncate" title={log.errorMessage}>
                                                                {log.errorMessage}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="text-sm text-slate-200">
                                                            <span className="text-green-400">{log.invoicesCreated}</span> created
                                                            {log.invoicesUpdated > 0 && (
                                                                <> / <span className="text-blue-400">{log.invoicesUpdated}</span> updated</>
                                                            )}
                                                            {log.invoicesFailed > 0 && (
                                                                <> / <span className="text-red-400">{log.invoicesFailed}</span> failed</>
                                                            )}
                                                            {' '}of {log.invoicesFound}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="text-sm text-slate-300">
                                                            {formatDuration(log.startedAt, log.completedAt)}
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
                                                        <td colSpan={5} className="py-4 px-4 bg-slate-700/20">
                                                            <div className="space-y-3">
                                                                {log.errors.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-slate-300 mb-2">Errors:</h4>
                                                                        <div className="space-y-1">
                                                                            {log.errors.slice(0, 10).map((error, idx) => (
                                                                                <div key={idx} className="text-xs text-red-400 bg-red-900/20 rounded p-2">
                                                                                    {error}
                                                                                </div>
                                                                            ))}
                                                                            {log.errors.length > 10 && (
                                                                                <div className="text-xs text-slate-500">
                                                                                    ... and {log.errors.length - 10} more errors
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {log.invoiceLogs.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-slate-300 mb-2">Invoice Details:</h4>
                                                                        <div className="space-y-2">
                                                                            {log.invoiceLogs.map((invoiceLog) => (
                                                                                <div
                                                                                    key={invoiceLog.id}
                                                                                    className="bg-slate-800 rounded-lg p-3 border border-slate-700"
                                                                                >
                                                                                    <div className="flex items-center justify-between mb-2">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={getInvoiceStatusBadge(invoiceLog.status)}>
                                                                                                {invoiceLog.status}
                                                                                            </span>
                                                                                            <span className="text-sm text-slate-300">
                                                                                                Invoice #{invoiceLog.invoice.number || invoiceLog.invoice.harvestId}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-400 space-y-1">
                                                                                        {invoiceLog.invoice.clientName && (
                                                                                            <div>
                                                                                                <span className="font-semibold">Client:</span> {invoiceLog.invoice.clientName}
                                                                                            </div>
                                                                                        )}
                                                                                        {invoiceLog.invoice.amount && (
                                                                                            <div>
                                                                                                <span className="font-semibold">Amount:</span> {formatCurrency(invoiceLog.invoice.amount, invoiceLog.invoice.currency)}
                                                                                            </div>
                                                                                        )}
                                                                                        {invoiceLog.errorMessage && (
                                                                                            <div className="text-red-400 mt-2">
                                                                                                <span className="font-semibold">Error:</span> {invoiceLog.errorMessage}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
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

