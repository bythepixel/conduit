import Head from 'next/head'
import Header from '../components/Header'
import { useState, useEffect } from 'react'

type Mapping = {
    id: number
    slackChannelId: string
    hubspotCompanyId: string
    slackChannelName?: string
    hubspotCompanyName?: string
    lastSyncedAt?: string
}

type SyncResultDetail = {
    id: number
    status: string
    summary?: string
    destination?: {
        name?: string
        id: string
    }
    error?: string
}

import { useSession } from "next-auth/react"
import { useRouter } from "next/router"

// ... types ...

export default function Home() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [mappings, setMappings] = useState<Mapping[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ slackChannelId: '', hubspotCompanyId: '', slackChannelName: '', hubspotCompanyName: '' })
    const [syncing, setSyncing] = useState(false)
    const [syncResult, setSyncResult] = useState<SyncResultDetail[] | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [syncingIds, setSyncingIds] = useState<number[]>([])

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchMappings()
        }
    }, [status])

    if (status === "loading") {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center">Loading...</div>
    }

    if (!session) {
        return null // Will redirect
    }

    const fetchMappings = async () => {
        const res = await fetch('/api/mappings')
        const data = await res.json()
        setMappings(data)
        setLoading(false)
    }

    const handleDelete = async (id: number) => {
        await fetch(`/api/mappings/${id}`, { method: 'DELETE' })
        fetchMappings()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (editingId) {
            await fetch(`/api/mappings/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            setEditingId(null)
        } else {
            await fetch('/api/mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
        }

        setForm({ slackChannelId: '', hubspotCompanyId: '', slackChannelName: '', hubspotCompanyName: '' })
        fetchMappings()
    }

    const handleEdit = (mapping: Mapping) => {
        setForm({
            slackChannelId: mapping.slackChannelId,
            hubspotCompanyId: mapping.hubspotCompanyId,
            slackChannelName: mapping.slackChannelName || '',
            hubspotCompanyName: mapping.hubspotCompanyName || ''
        })
        setEditingId(mapping.id)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setForm({ slackChannelId: '', hubspotCompanyId: '', slackChannelName: '', hubspotCompanyName: '' })
    }

    const handleSync = async () => {
        setSyncing(true)
        setSyncResult(null)
        try {
            const res = await fetch('/api/sync', { method: 'POST' })
            const data = await res.json()
            setSyncResult(data.results)
            fetchMappings()
        } catch (e) {
            console.error(e)
            // Error handling could be improved, but setting null or localized error
        }
        setSyncing(false)
    }

    const handleSingleSync = async (id: number) => {
        setSyncingIds(prev => [...prev, id])
        setSyncResult(null)
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mappingId: id })
            })
            const data = await res.json()
            setSyncResult(data.results)
            fetchMappings()
        } catch (e) {
            console.error(e)
        }
        setSyncingIds(prev => prev.filter(mid => mid !== id))
    }

    return (
        <div className="min-h-screen bg-slate-900 p-8 font-sans">
            <Head>
                <title>Slacky Hub Admin</title>
            </Head>

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <Header
                    action={
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`px-6 py-2 rounded-full font-bold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 text-sm ${syncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                                }`}
                        >
                            {syncing ? 'Syncing...' : 'Trigger Sync Now'}
                        </button>
                    }
                />

                {syncResult && (
                    <div className="space-y-4">
                        {syncResult.map((res, i) => (
                            <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${res.error ? 'bg-red-900/20 text-red-300 border-red-800' : 'bg-emerald-900/20 text-emerald-100 border-emerald-800'}`}>
                                <div className="flex items-center gap-2 font-semibold">
                                    <span>{res.error ? '❌' : '✅'}</span>
                                    <span>{res.status}</span>
                                    {res.destination && (
                                        <span className="text-sm opacity-80 max-w-lg truncate">
                                            → {res.destination.name || res.destination.id}
                                        </span>
                                    )}
                                </div>
                                {res.summary && (
                                    <div className="mt-2 p-3 bg-slate-800/50 rounded-lg text-sm font-mono whitespace-pre-wrap border border-black/5 max-h-60 overflow-y-auto">
                                        {res.summary}
                                    </div>
                                )}
                                {res.error && <p className="text-sm">{res.error}</p>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Form */}
                    <div className="md:col-span-1">
                        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-8">
                            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <span>{editingId ? '✏️' : '➕'}</span> {editingId ? 'Edit Mapping' : 'New Mapping'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Slack Channel ID</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="C12345678"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                        value={form.slackChannelId}
                                        onChange={e => setForm({ ...form, slackChannelId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">HubSpot Company ID</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="123456789"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                        value={form.hubspotCompanyId}
                                        onChange={e => setForm({ ...form, hubspotCompanyId: e.target.value })}
                                    />
                                </div>
                                <div className="pt-2 border-t border-slate-700">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Channel Name (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="#general"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                        value={form.slackChannelName}
                                        onChange={e => setForm({ ...form, slackChannelName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Name (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="Acme Corp"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                        value={form.hubspotCompanyName}
                                        onChange={e => setForm({ ...form, hubspotCompanyName: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                        {editingId ? 'Update Mapping' : 'Add Mapping'}
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
                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                            <span>🔗</span> Active Mappings
                        </h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl shadow-sm" />)}
                            </div>
                        ) : mappings.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                                No mappings found. Add one to get started.
                            </div>
                        ) : (
                            mappings.map(m => (
                                <div key={m.id} className="group bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 flex justify-between items-center hover:shadow-md transition-all">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg text-slate-100">{m.slackChannelName || m.slackChannelId}</span>
                                            <span className="text-slate-500">→</span>
                                            <span className="font-bold text-lg text-slate-100">{m.hubspotCompanyName || m.hubspotCompanyId}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                                            <span className="bg-slate-700 px-2 py-1 rounded">Slack: {m.slackChannelId}</span>
                                            <span className="bg-slate-700 px-2 py-1 rounded">HubSpot: {m.hubspotCompanyId}</span>
                                        </div>
                                        {m.lastSyncedAt && <p className="text-xs text-indigo-500 mt-2">Last synced: {new Date(m.lastSyncedAt).toLocaleString()}</p>}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleSingleSync(m.id)}
                                            disabled={syncing || syncingIds.includes(m.id)}
                                            className={`p-2 rounded-lg transition-colors ${syncing || syncingIds.includes(m.id) ? 'text-slate-500 cursor-not-allowed' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-900/20'}`}
                                            title="Sync Now"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncingIds.includes(m.id) ? 'animate-spin' : ''}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                                        </button>
                                        <button
                                            onClick={() => handleEdit(m)}
                                            disabled={syncingIds.includes(m.id)}
                                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                                            title="Edit Mapping"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(m.id)}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                            title="Remove Mapping"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
