import Head from 'next/head'
import { useState, useEffect } from 'react'
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'
import { useAuthGuard } from '../../lib/hooks/useAuthGuard'
import { useApiCall } from '../../lib/hooks/useApiCall'
import { formatSyncResults } from '../../lib/utils/formatHelpers'

type SlackChannel = {
    id: number
    channelId: string
    name?: string
    isClient: boolean
    createdAt: string
    updatedAt: string
    _count?: {
        mappings: number
    }
}

export default function SlackChannels() {
    const { isLoading } = useAuthGuard()
    const [channels, setChannels] = useState<SlackChannel[]>([])
    const [form, setForm] = useState({ channelId: '', name: '', isClient: false })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; channelId: number | null }>({ show: false, channelId: null })
    const [syncing, setSyncing] = useState(false)
    const [search, setSearch] = useState('')
    const [showSyncConfirm, setShowSyncConfirm] = useState(false)
    const { modalConfig, setModalConfig, closeModal } = useApiCall()

    useEffect(() => {
        if (!isLoading) {
            fetchChannels()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading])

    const fetchChannels = async () => {
        try {
            const res = await fetch('/api/slack-channels')
            if (res.ok) {
                const data = await res.json()
                setChannels(data)
            } else {
                console.error('Failed to fetch channels:', res.status, res.statusText)
            }
        } catch (error: any) {
            console.error('Error fetching channels:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingId) {
                const res = await fetch(`/api/slack-channels/${editingId}`, {
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
                        message: error.error || 'Failed to update channel'
                    })
                    return
                }
                setEditingId(null)
            } else {
                const res = await fetch('/api/slack-channels', {
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
                        message: error.error || 'Failed to create channel'
                    })
                    return
                }
            }

            setForm({ channelId: '', name: '', isClient: false })
            await fetchChannels()
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        }
    }

    const handleEdit = (channel: SlackChannel) => {
        setForm({
            channelId: channel.channelId,
            name: channel.name || '',
            isClient: channel.isClient
        })
        setEditingId(channel.id)
    }

    const handleToggleIsClient = async (id: number, isClient: boolean) => {
        try {
            const res = await fetch(`/api/slack-channels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: channels.find(c => c.id === id)?.channelId,
                    name: channels.find(c => c.id === id)?.name,
                    isClient
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Update Failed',
                    message: error.error || 'Failed to update channel'
                })
                return
            }
            await fetchChannels()
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
        setForm({ channelId: '', name: '', isClient: false })
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteConfirm({ show: true, channelId: id })
    }

    const confirmDelete = async () => {
        if (deleteConfirm.channelId === null) return

        const res = await fetch(`/api/slack-channels/${deleteConfirm.channelId}`, { method: 'DELETE' })
        if (res.ok) {
            fetchChannels()
        } else {
            const error = await res.json()
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Delete Failed',
                message: error.error || 'Failed to delete channel'
            })
        }
        setDeleteConfirm({ show: false, channelId: null })
    }

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, channelId: null })
    }

    const handleSync = async () => {
        setShowSyncConfirm(true)
    }

    const handleConfirmSync = async () => {
        setShowSyncConfirm(false)
        setSyncing(true)
        try {
            const res = await fetch('/api/slack-channels/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (res.ok) {
                const errorCount = data.results.errors?.length || 0
                const message = formatSyncResults(data.results)
                setModalConfig({
                    isOpen: true,
                    type: errorCount > 0 ? 'info' : 'success',
                    title: 'Sync Results',
                    message: message
                })
                await fetchChannels()
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Sync Failed',
                    message: data.error || 'Failed to sync channels'
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

    if (isLoading) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Head>
                <title>Slack Channels - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-8">
                    {/* Form - Only shown when editing */}
                    {editingId && (
                        <div>
                            <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 sticky top-20 p-6">
                                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-6">
                                    <span>✏️</span> Edit Channel
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Channel Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="#general"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Channel ID <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono"
                                            value={form.channelId}
                                            onChange={e => setForm({ ...form, channelId: e.target.value })}
                                            placeholder="C12345678"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.isClient}
                                                onChange={(e) => setForm({ ...form, isClient: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-2"
                                            />
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Is Client</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                            Update Channel
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
                        ) : channels.length === 0 ? (
                            <div className="text-center py-8 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 text-sm">
                                No channels found. Create your first channel!
                            </div>
                        ) : (() => {
                            // Filter channels by search
                            const filteredChannels = channels.filter(c => {
                                if (!search.trim()) return true
                                const searchLower = search.toLowerCase()
                                const name = c.name?.toLowerCase() || ''
                                const channelId = c.channelId.toLowerCase()
                                return name.includes(searchLower) || channelId.includes(searchLower)
                            })

                            // Group channels by isClient
                            const partnerChannels = filteredChannels.filter(c => c.isClient)
                            const internalChannels = filteredChannels.filter(c => !c.isClient)

                            const renderChannelCard = (c: SlackChannel) => (
                                <div key={c.id} className={`group p-3 rounded-lg shadow-sm border hover:shadow-md transition-all ${c.isClient
                                    ? 'bg-green-900/30 border-green-700/50'
                                    : 'bg-slate-800 border-slate-700'
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="font-semibold text-sm text-slate-100 truncate">
                                                    {c.name ? (c.name.startsWith('#') ? c.name : `#${c.name}`) : 'Unnamed Channel'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-slate-500 text-xs font-mono">{c.channelId}</p>
                                                {c._count && c._count.mappings > 0 && (
                                                    <span className="text-xs text-indigo-400">
                                                        {c._count.mappings} mapping{c._count.mappings !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                                            <label className="cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={c.isClient}
                                                    onChange={(e) => handleToggleIsClient(c.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500 focus:ring-2"
                                                    title="Is Client"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(c)}
                                                className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-1.5 rounded transition-colors"
                                                title="Edit Channel"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(e, c.id)}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-1.5 rounded transition-colors"
                                                title="Delete Channel"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )

                            if (partnerChannels.length === 0 && internalChannels.length === 0) {
                                return (
                                    <div className="text-center py-8 bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 text-sm">
                                        No channels match "{search}"
                                    </div>
                                )
                            }

                            return (
                                <div className="space-y-6">
                                    {/* Partner Channels */}
                                    {partnerChannels.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                                                    <span>🤝</span> Partner Channels
                                                </h3>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Search channels..."
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
                                                        title="Sync all channels from Slack"
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
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                {partnerChannels.map(renderChannelCard)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Internal Channels */}
                                    {internalChannels.length > 0 && (
                                        <div>
                                            <h3 className="text-md font-bold text-slate-200 flex items-center gap-2 mb-3">
                                                <span>🏢</span> Internal Channels
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                {internalChannels.map(renderChannelCard)}
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
                                <h3 className="text-xl font-bold text-slate-100">Delete Channel</h3>
                                <p className="text-slate-500 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to delete this channel? All of its data will be permanently removed. If it's used in any mappings, you'll need to remove those first.
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
            {/* Sync Confirmation Modal */}
            {showSyncConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSyncConfirm(false)}>
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-100">Sync Channels</h3>
                                <p className="text-slate-500 text-sm">Update from Slack</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will fetch and update all channel data from Slack. This might take a moment if there are many updates.
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
                onClose={closeModal}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
            />

        </div>
    )
}

