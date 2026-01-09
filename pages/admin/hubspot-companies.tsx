import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'

type HubspotCompany = {
    id: number
    companyId: string
    name?: string
    btpAbbreviation?: string
    activeClient: boolean
    ownerId?: string
    createdAt: string
    updatedAt: string
    _count?: {
        mappings: number
    }
}

export default function HubspotCompanies() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [companies, setCompanies] = useState<HubspotCompany[]>([])
    const [form, setForm] = useState({ companyId: '', name: '', btpAbbreviation: '', activeClient: false })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; companyId: number | null }>({ show: false, companyId: null })
    const [syncing, setSyncing] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [showAbbrevConfirm, setShowAbbrevConfirm] = useState(false)
    const [showSyncConfirm, setShowSyncConfirm] = useState(false)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
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
            fetchCompanies()
        }
    }, [status])

    const fetchCompanies = async () => {
        try {
            const res = await fetch('/api/hubspot-companies')
            if (res.ok) {
                const data = await res.json()
                setCompanies(data)
            } else {
                console.error('Failed to fetch companies:', res.status, res.statusText)
            }
        } catch (error: any) {
            console.error('Error fetching companies:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingId) {
                const res = await fetch(`/api/hubspot-companies/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    setModalConfig({
                        isOpen: true,
                        type: 'error',
                        title: 'Update Failed',
                        message: error.error || 'Failed to update company'
                    })
                    return
                }
                setEditingId(null)
            } else {
                const res = await fetch('/api/hubspot-companies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    setModalConfig({
                        isOpen: true,
                        type: 'error',
                        title: 'Creation Failed',
                        message: error.error || 'Failed to create company'
                    })
                    return
                }
            }

            setForm({ companyId: '', name: '', btpAbbreviation: '', activeClient: false })
            setFormOpen(false)
            await fetchCompanies()
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        }
    }

    const handleEdit = (company: HubspotCompany) => {
        setForm({
            companyId: company.companyId,
            name: company.name || '',
            btpAbbreviation: company.btpAbbreviation || '',
            activeClient: company.activeClient
        })
        setEditingId(company.id)
        setFormOpen(true)
    }

    const handleToggleActiveClient = async (id: number, activeClient: boolean) => {
        try {
            const res = await fetch(`/api/hubspot-companies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: companies.find(c => c.id === id)?.companyId,
                    name: companies.find(c => c.id === id)?.name,
                    btpAbbreviation: companies.find(c => c.id === id)?.btpAbbreviation,
                    activeClient
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Update Failed',
                    message: error.error || 'Failed to update company'
                })
                return
            }
            await fetchCompanies()
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        }
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setForm({ companyId: '', name: '', btpAbbreviation: '', activeClient: false })
        setFormOpen(false)
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteConfirm({ show: true, companyId: id })
    }

    const confirmDelete = async () => {
        if (deleteConfirm.companyId === null) return

        const res = await fetch(`/api/hubspot-companies/${deleteConfirm.companyId}`, { method: 'DELETE' })
        if (res.ok) {
            fetchCompanies()
        } else {
            const error = await res.json()
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Delete Failed',
                message: error.error || 'Failed to delete company'
            })
        }
        setDeleteConfirm({ show: false, companyId: null })
    }

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, companyId: null })
    }

    const handleSync = async () => {
        setShowSyncConfirm(true)
    }

    const handleConfirmSync = async () => {
        setShowSyncConfirm(false)
        setSyncing(true)
        try {
            const res = await fetch('/api/hubspot-companies/sync', {
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
                await fetchCompanies()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Sync Failed',
                    message: data.error || 'Failed to sync companies'
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

    const handleGenerateAbbreviations = async () => {
        setShowAbbrevConfirm(true)
    }

    const handleConfirmGenerateAbbreviations = async () => {
        setShowAbbrevConfirm(false)

        setGenerating(true)
        try {
            const res = await fetch('/api/hubspot-companies/generate-abbreviations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                const errorCount = data.results.errors?.length || 0
                let message = `Abbreviation generation completed!\nUpdated: ${data.results.updated}\nSkipped: ${data.results.skipped}`
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
                    title: 'Abbreviation Results',
                    message: message
                })
                await fetchCompanies()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Generation Failed',
                    message: 'Failed to generate abbreviations: ' + (data.error || 'Unknown error')
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Generation Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        } finally {
            setGenerating(false)
        }
    }

    const handleClearAbbreviations = async () => {
        setShowClearConfirm(true)
    }

    const handleConfirmClearAbbreviations = async () => {
        setShowClearConfirm(false)
        setClearing(true)
        try {
            const res = await fetch('/api/hubspot-companies/clear-abbreviations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Success',
                    message: data.message || 'All abbreviations cleared successfully'
                })
                await fetchCompanies()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Clear Failed',
                    message: data.error || 'Failed to clear abbreviations'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Clear Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        } finally {
            setClearing(false)
        }
    }

    if (status === "loading" || !session) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Head>
                <title>HubSpot Companies - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-8">
                    {/* Form - Only shown when editing */}
                    {editingId && (
                        <div>
                            <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 sticky top-20 p-6">
                                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-6">
                                    <span>✏️</span> Edit Company
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="Acme Corp"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company ID <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono"
                                            value={form.companyId}
                                            onChange={e => setForm({ ...form, companyId: e.target.value })}
                                            placeholder="123456789"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">BTP Abbreviation</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                            value={form.btpAbbreviation}
                                            onChange={e => setForm({ ...form, btpAbbreviation: e.target.value })}
                                            placeholder="ACME"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.activeClient}
                                                onChange={(e) => setForm({ ...form, activeClient: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-2"
                                            />
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Client</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                            Update Company
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="px-4 py-3 bg-slate-600 text-slate-500 rounded-xl font-semibold hover:bg-slate-500 transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className={editingId ? '' : 'lg:col-span-2'}>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-16 bg-slate-800 rounded-lg shadow-sm" />)}
                            </div>
                        ) : companies.length === 0 ? (
                            <div className="text-center py-8 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 text-sm">
                                No companies found. Create your first company!
                            </div>
                        ) : (() => {
                            // Filter companies by search
                            const filteredCompanies = companies.filter(c => {
                                if (!search.trim()) return true
                                const searchLower = search.toLowerCase()
                                const name = c.name?.toLowerCase() || ''
                                const companyId = c.companyId.toLowerCase()
                                const btpAbbr = c.btpAbbreviation?.toLowerCase() || ''
                                return name.includes(searchLower) || companyId.includes(searchLower) || btpAbbr.includes(searchLower)
                            })

                            // Group companies by activeClient
                            const partnerCompanies = filteredCompanies.filter(c => c.activeClient)
                            const contactCompanies = filteredCompanies.filter(c => !c.activeClient)

                            const renderCompanyCard = (c: HubspotCompany) => (
                                <div key={c.id} className={`group p-3 rounded-lg shadow-sm border hover:shadow-md transition-all ${c.activeClient
                                    ? 'bg-green-900/30 border-green-700/50'
                                    : 'bg-slate-800 border-slate-700'
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="font-semibold text-sm text-slate-100 truncate">{c.name || 'Unnamed Company'}</p>
                                                {c.btpAbbreviation && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded">
                                                        {c.btpAbbreviation}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-slate-500 text-xs font-mono">{c.companyId}</p>
                                                {c.ownerId && (
                                                    <span className="text-xs text-slate-400">
                                                        Owner: <span className="font-mono">{c.ownerId}</span>
                                                    </span>
                                                )}
                                                {c._count && c._count.mappings > 0 && (
                                                    <span className="text-xs text-indigo-400">
                                                        {c._count.mappings} mapping{c._count.mappings !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={c.activeClient}
                                                    onChange={(e) => handleToggleActiveClient(c.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-2"
                                                    title="Active Client"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(c)}
                                                className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-1.5 rounded transition-colors"
                                                title="Edit Company"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(e, c.id)}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-1.5 rounded transition-colors"
                                                title="Delete Company"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )

                            if (partnerCompanies.length === 0 && contactCompanies.length === 0) {
                                return (
                                    <div className="text-center py-8 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 text-sm">
                                        No companies match "{search}"
                                    </div>
                                )
                            }

                            return (
                                <div className="space-y-6">
                                    {/* Partner Companies */}
                                    {partnerCompanies.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                                                    <span>🤝</span> Partner Companies
                                                </h3>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Search companies..."
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
                                                        title="Sync all companies from HubSpot"
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
                                                    {/* 
                                                     <button
                                                         onClick={handleGenerateAbbreviations}
                                                         disabled={generating}
                                                         className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${generating
                                                             ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                                                             : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                                             }`}
                                                         title="Generate abbreviations for companies without one"
                                                     >
                                                         {generating ? (
                                                             <>
                                                                 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                 </svg>
                                                                 <span className="text-sm">Generating...</span>
                                                             </>
                                                         ) : (
                                                             <>
                                                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                     <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                                 </svg>
                                                                 <span className="text-sm">Generate Abbrevs</span>
                                                             </>
                                                         )}
                                                     </button>
                                                     <button
                                                         onClick={handleClearAbbreviations}
                                                         disabled={clearing}
                                                         className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${clearing
                                                             ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                                                             : 'bg-red-500 hover:bg-red-600'
                                                             }`}
                                                         title="Clear all abbreviations"
                                                     >
                                                         {clearing ? (
                                                             <>
                                                                 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                 </svg>
                                                                 <span className="text-sm">Clearing...</span>
                                                             </>
                                                         ) : (
                                                             <>
                                                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                     <path d="M3 6h18" />
                                                                     <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                     <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                                 </svg>
                                                                 <span className="text-sm">Clear All</span>
                                                             </>
                                                         )}
                                                     </button>
                                                     */}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                {partnerCompanies.map(renderCompanyCard)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact Companies */}
                                    {contactCompanies.length > 0 && (
                                        <div>
                                            <h3 className="text-md font-bold text-slate-200 mb-3 flex items-center gap-2">
                                                <span>📇</span> Contact Companies
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                {contactCompanies.map(renderCompanyCard)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={cancelDelete}>
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-100">Delete Company</h3>
                                <p className="text-slate-500 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to delete this company? All of its data will be permanently removed. If it's used in any mappings, you'll need to remove those first.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={cancelDelete}
                                className="flex-1 px-4 py-3 bg-slate-700 text-slate-500 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all active:scale-95"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Abbreviation Generation Confirmation Modal */}
            {showAbbrevConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAbbrevConfirm(false)}>
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-100">Generate Abbreviations</h3>
                                <p className="text-slate-500 text-sm">Automated generation</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will generate abbreviations for all companies that don't have one using AI. This process might take a few moments.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAbbrevConfirm(false)}
                                className="flex-1 px-4 py-3 bg-slate-700 text-slate-500 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmGenerateAbbreviations}
                                className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition-all active:scale-95"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                                <h3 className="text-xl font-bold text-slate-100">Sync Companies</h3>
                                <p className="text-slate-500 text-sm">Update from HubSpot</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will fetch and update all company data from HubSpot. This might take a moment if there are many updates.
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

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowClearConfirm(false)}>
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-100">Clear Abbreviations</h3>
                                <p className="text-slate-500 text-sm">Action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6 font-medium">
                            Are you sure you want to clear abbreviations for ALL companies? This will remove all current BTP abbreviations.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1 px-4 py-3 bg-slate-700 text-slate-500 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmClearAbbreviations}
                                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all active:scale-95"
                            >
                                Clear All
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

