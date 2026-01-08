import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'

type HarvestInvoice = {
    id: number
    harvestId: string
    clientId?: string
    clientName?: string
    number?: string
    purchaseOrder?: string
    amount?: number
    dueAmount?: number
    tax?: number
    taxAmount?: number
    discount?: number
    discountAmount?: number
    subject?: string
    notes?: string
    currency?: string
    state?: string
    issueDate?: string
    dueDate?: string
    paidDate?: string
    paymentTerm?: string
    createdAt: string
    updatedAt: string
}

export default function HarvestInvoices() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [invoices, setInvoices] = useState<HarvestInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [syncingInvoices, setSyncingInvoices] = useState<Set<number>>(new Set())
    const [creatingDeals, setCreatingDeals] = useState<Set<number>>(new Set())
    const [search, setSearch] = useState('')
    const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set())
    const [showSyncConfirm, setShowSyncConfirm] = useState(false)
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean, type: 'error' | 'success' | 'info', title: string, message: string }>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    })

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchInvoices()
        }
    }, [status])

    const fetchInvoices = async () => {
        try {
            const res = await fetch('/api/harvest-invoices')
            if (res.ok) {
                const data = await res.json()
                setInvoices(data)
            } else {
                console.error('Failed to fetch invoices:', res.status, res.statusText)
            }
        } catch (error: any) {
            console.error('Error fetching invoices:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        setShowSyncConfirm(true)
    }

    const handleConfirmSync = async () => {
        setShowSyncConfirm(false)
        setSyncing(true)
        try {
            const res = await fetch('/api/harvest-invoices/sync', {
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
                setModalConfig({
                    isOpen: true,
                    type: errorCount > 0 ? 'info' : 'success',
                    title: 'Sync Results',
                    message: message
                })
                await fetchInvoices()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Sync Failed',
                    message: data.error || 'Failed to sync invoices'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Sync Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        } finally {
            setSyncing(false)
        }
    }

    const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined): string => {
        if (amount === null || amount === undefined) return 'N/A'
        const currencyCode = currency || 'USD'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode
        }).format(amount)
    }

    const formatDate = (date: string | null | undefined): string => {
        if (!date) return 'N/A'
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const getStateColor = (state: string | null | undefined): string => {
        switch (state?.toLowerCase()) {
            case 'draft':
                return 'bg-slate-700/50 text-slate-300'
            case 'open':
                return 'bg-yellow-700/50 text-yellow-300'
            case 'paid':
                return 'bg-green-700/50 text-green-300'
            case 'closed':
                return 'bg-gray-700/50 text-gray-300'
            default:
                return 'bg-slate-700/50 text-slate-300'
        }
    }

    const toggleExpand = (invoiceId: number) => {
        const newExpanded = new Set(expandedInvoices)
        if (newExpanded.has(invoiceId)) {
            newExpanded.delete(invoiceId)
        } else {
            newExpanded.add(invoiceId)
        }
        setExpandedInvoices(newExpanded)
    }

    const handleSingleSync = async (invoiceId: number) => {
        setSyncingInvoices(prev => new Set(prev).add(invoiceId))
        try {
            const res = await fetch(`/api/harvest-invoices/${invoiceId}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Sync Successful',
                    message: 'Invoice synced successfully from Harvest.'
                })
                await fetchInvoices()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Sync Failed',
                    message: data.error || 'Failed to sync invoice'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Sync Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        } finally {
            setSyncingInvoices(prev => {
                const newSet = new Set(prev)
                newSet.delete(invoiceId)
                return newSet
            })
        }
    }

    const handleCreateDeal = async (invoiceId: number) => {
        setCreatingDeals(prev => {
            const newSet = new Set(prev)
            newSet.add(invoiceId)
            return newSet
        })

        try {
            const res = await fetch(`/api/harvest-invoices/${invoiceId}/create-deal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Deal Created',
                    message: `Successfully created HubSpot deal!\n\nDeal ID: ${data.dealId}\nCompany ID: ${data.companyId}${data.dealUrl ? `\n\nView deal: ${data.dealUrl}` : ''}`
                })
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Create Deal Failed',
                    message: data.error || 'Failed to create deal'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        } finally {
            setCreatingDeals(prev => {
                const newSet = new Set(prev)
                newSet.delete(invoiceId)
                return newSet
            })
        }
    }

    if (status === "loading" || !session) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">Loading...</div>

    // Filter invoices by search
    const filteredInvoices = invoices.filter(inv => {
        if (!search.trim()) return true
        const searchLower = search.toLowerCase()
        const clientName = inv.clientName?.toLowerCase() || ''
        const number = inv.number?.toLowerCase() || ''
        const subject = inv.subject?.toLowerCase() || ''
        const harvestId = inv.harvestId.toLowerCase()
        return clientName.includes(searchLower) || 
               number.includes(searchLower) || 
               subject.includes(searchLower) ||
               harvestId.includes(searchLower)
    })

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Head>
                <title>Harvest Invoices - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <span>🧾</span> Harvest Invoices
                    </h1>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search invoices..."
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
                            title="Sync invoices from Harvest"
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
                                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
                                    </svg>
                                    <span className="text-sm">Sync</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl shadow-sm" />)}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                        {search ? `No invoices match "${search}"` : 'No invoices found. Click Sync to import invoices from Harvest.'}
                    </div>
                ) : (
                    <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Invoice #</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">State</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Issue Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Paid Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"></th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredInvoices.map((invoice) => (
                                        <>
                                            <tr key={invoice.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => toggleExpand(invoice.id)}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-slate-100">{invoice.number || invoice.harvestId}</div>
                                                    {invoice.purchaseOrder && (
                                                        <div className="text-xs text-slate-500">PO: {invoice.purchaseOrder}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-slate-200">{invoice.clientName || 'N/A'}</div>
                                                    {invoice.clientId && (
                                                        <div className="text-xs text-slate-500 font-mono">{invoice.clientId}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-slate-100">
                                                        {formatCurrency(invoice.amount, invoice.currency)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${getStateColor(invoice.state)}`}>
                                                        {invoice.state || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {formatDate(invoice.issueDate)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {formatDate(invoice.paidDate)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleExpand(invoice.id)
                                                        }}
                                                        className="text-slate-400 hover:text-slate-200 transition-colors"
                                                    >
                                                        {expandedInvoices.has(invoice.id) ? (
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
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleSingleSync(invoice.id)
                                                            }}
                                                            disabled={syncingInvoices.has(invoice.id) || syncing}
                                                            className={`p-2 rounded-lg transition-colors ${
                                                                syncingInvoices.has(invoice.id) || syncing
                                                                    ? 'text-slate-500 cursor-not-allowed'
                                                                    : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-900/20'
                                                            }`}
                                                            title="Sync this invoice from Harvest"
                                                        >
                                                            {syncingInvoices.has(invoice.id) ? (
                                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCreateDeal(invoice.id)
                                                            }}
                                                            disabled={creatingDeals.has(invoice.id)}
                                                            className={`p-2 rounded-lg transition-colors ${
                                                                creatingDeals.has(invoice.id)
                                                                    ? 'text-slate-500 cursor-not-allowed'
                                                                    : 'text-green-400 hover:text-green-600 hover:bg-green-900/20'
                                                            }`}
                                                            title="Create HubSpot deal from this invoice"
                                                        >
                                                            {creatingDeals.has(invoice.id) ? (
                                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
                                                                    <line x1="18" y1="3" x2="12" y2="9"></line>
                                                                    <line x1="15" y1="3" x2="21" y2="3"></line>
                                                                    <line x1="21" y1="3" x2="21" y2="9"></line>
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedInvoices.has(invoice.id) && (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-4 bg-slate-700/20">
                                                        <div className="space-y-2">
                                                            <div>
                                                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject:</span>
                                                                <div className="text-sm text-slate-200 mt-1">{invoice.subject || 'N/A'}</div>
                                                            </div>
                                                            {invoice.notes && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes:</span>
                                                                    <div className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{invoice.notes}</div>
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
                    </div>
                )}
            </div>

            {/* Sync Confirmation Modal */}
            {showSyncConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSyncConfirm(false)}>
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-100">Sync Invoices</h3>
                                <p className="text-slate-500 text-sm">Update from Harvest</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will fetch and update all invoice data from Harvest. This might take a moment if there are many invoices.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSyncConfirm(false)}
                                className="flex-1 px-4 py-3 bg-slate-700 text-slate-500 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSync}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all active:scale-95"
                            >
                                Sync Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Results Modal */}
            <ErrorModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
            />
        </div>
    )
}

