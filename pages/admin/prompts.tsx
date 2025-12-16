import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'

type Prompt = {
    id: number
    name: string
    content: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export default function Prompts() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [form, setForm] = useState({ name: '', content: '', isActive: false })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; promptId: number | null }>({ show: false, promptId: null })

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchPrompts()
        }
    }, [status])

    const fetchPrompts = async () => {
        try {
            const res = await fetch('/api/prompts')
            if (res.ok) {
                const data = await res.json()
                setPrompts(data)
            } else {
                console.error('Failed to fetch prompts:', res.status, res.statusText)
                const error = await res.json().catch(() => ({ error: 'Unknown error' }))
                console.error('Error details:', error)
            }
        } catch (error: any) {
            console.error('Error fetching prompts:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingId) {
                const res = await fetch(`/api/prompts/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    alert(error.error || 'Failed to update prompt')
                    return
                }
                setEditingId(null)
            } else {
                const res = await fetch('/api/prompts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    alert(error.error || 'Failed to create prompt')
                    return
                }
            }

            setForm({ name: '', content: '', isActive: false })
            await fetchPrompts()
        } catch (error: any) {
            alert('An error occurred: ' + (error.message || 'Unknown error'))
        }
    }

    const handleEdit = (prompt: Prompt) => {
        setForm({
            name: prompt.name,
            content: prompt.content,
            isActive: prompt.isActive
        })
        setEditingId(prompt.id)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setForm({ name: '', content: '', isActive: false })
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteConfirm({ show: true, promptId: id })
    }

    const confirmDelete = async () => {
        if (deleteConfirm.promptId === null) return

        const res = await fetch(`/api/prompts/${deleteConfirm.promptId}`, { method: 'DELETE' })
        if (res.ok) {
            fetchPrompts()
        } else {
            const error = await res.json()
            alert(error.error || 'Failed to delete prompt')
        }
        setDeleteConfirm({ show: false, promptId: null })
    }

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, promptId: null })
    }

    const handleActivate = async (id: number) => {
        const res = await fetch(`/api/prompts/${id}/activate`, { method: 'POST' })
        if (res.ok) {
            fetchPrompts()
        } else {
            const error = await res.json()
            alert(error.error || 'Failed to activate prompt')
        }
    }

    if (status === "loading" || !session) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 p-8 font-sans">
            <Head>
                <title>Prompt Management - Slacky Hub</title>
            </Head>

            <div className="max-w-6xl mx-auto space-y-8">
                <Header />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form */}
                    <div>
                        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-8">
                            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <span>{editingId ? '✏️' : '➕'}</span> {editingId ? 'Edit Prompt' : 'Create Prompt'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Name <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required 
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                                        value={form.name} 
                                        onChange={e => setForm({ ...form, name: e.target.value })} 
                                        placeholder="e.g., Default Summary Prompt"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Content <span className="text-red-500">*</span></label>
                                    <textarea 
                                        required 
                                        rows={8}
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono" 
                                        value={form.content} 
                                        onChange={e => setForm({ ...form, content: e.target.value })} 
                                        placeholder="Enter the ChatGPT prompt content..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="isActive"
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-indigo-500" 
                                        checked={form.isActive} 
                                        onChange={e => setForm({ ...form, isActive: e.target.checked })} 
                                    />
                                    <label htmlFor="isActive" className="text-sm text-slate-300">
                                        Set as active prompt
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                        {editingId ? 'Update Prompt' : 'Create Prompt'}
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
                            <span>💬</span> All Prompts
                        </h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800 rounded-2xl shadow-sm" />)}
                            </div>
                        ) : prompts.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                                No prompts found. Create your first prompt!
                            </div>
                        ) : (
                            prompts.map(p => (
                                <div key={p.id} className={`group bg-slate-800 p-6 rounded-2xl shadow-sm border transition-all ${p.isActive ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:shadow-md'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-lg text-slate-100">{p.name}</p>
                                                {p.isActive && (
                                                    <span className="px-2 py-1 text-xs font-bold bg-indigo-500 text-white rounded-full">
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-xs font-mono line-clamp-3">{p.content}</p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                            {!p.isActive && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleActivate(p.id)}
                                                    className="text-green-400 hover:text-green-600 hover:bg-green-900/20 p-2 rounded-lg transition-colors"
                                                    title="Activate Prompt"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(p)}
                                                className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                                                title="Edit Prompt"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(e, p.id)}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                                title="Delete Prompt"
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
                                <h3 className="text-xl font-bold text-slate-100">Delete Prompt</h3>
                                <p className="text-slate-500 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to delete this prompt? All of its data will be permanently removed.
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

