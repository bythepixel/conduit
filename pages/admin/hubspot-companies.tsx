import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'

type HubspotCompany = {
    id: number
    companyId: string
    name?: string
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
    const [form, setForm] = useState({ companyId: '', name: '' })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; companyId: number | null }>({ show: false, companyId: null })

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
                    alert(error.error || 'Failed to update company')
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
                    alert(error.error || 'Failed to create company')
                    return
                }
            }

            setForm({ companyId: '', name: '' })
            await fetchCompanies()
        } catch (error: any) {
            alert('An error occurred: ' + (error.message || 'Unknown error'))
        }
    }

    const handleEdit = (company: HubspotCompany) => {
        setForm({
            companyId: company.companyId,
            name: company.name || ''
        })
        setEditingId(company.id)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setForm({ companyId: '', name: '' })
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
            alert(error.error || 'Failed to delete company')
        }
        setDeleteConfirm({ show: false, companyId: null })
    }

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, companyId: null })
    }

    if (status === "loading" || !session) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 p-8 font-sans">
            <Head>
                <title>HubSpot Companies - Slacky Hub</title>
            </Head>

            <div className="max-w-6xl mx-auto space-y-8">
                <Header
                    action={
                        <div className="text-xl font-bold text-slate-100">HubSpot Companies</div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form */}
                    <div>
                        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-8">
                            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <span>{editingId ? '✏️' : '➕'}</span> {editingId ? 'Edit Company' : 'Create Company'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                                        value={form.name} 
                                        onChange={e => setForm({ ...form, name: e.target.value })} 
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                        {editingId ? 'Update Company' : 'Create Company'}
                                    </button>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="px-4 py-3 bg-slate-600 text-slate-500 rounded-xl font-semibold hover:bg-slate-500 transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                            <span>🏢</span> All Companies
                        </h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl shadow-sm" />)}
                            </div>
                        ) : companies.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                                No companies found. Create your first company!
                            </div>
                        ) : (
                            companies.map(c => (
                                <div key={c.id} className="group bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-lg text-slate-100">{c.name || 'Unnamed Company'}</p>
                                            </div>
                                            <p className="text-slate-500 text-xs font-mono mb-2">{c.companyId}</p>
                                            {c._count && c._count.mappings > 0 && (
                                                <p className="text-xs text-indigo-400">
                                                    Used in {c._count.mappings} mapping{c._count.mappings !== 1 ? 's' : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(c)}
                                                className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                                                title="Edit Company"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(e, c.id)}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                                title="Delete Company"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
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
        </div>
    )
}

