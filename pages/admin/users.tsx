import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import Header from '../../components/Header'

type User = {
    id: number
    email: string
    firstName: string
    lastName: string
    slackId?: string
    isAdmin: boolean
    createdAt: string
}

export default function Users() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', slackId: '', isAdmin: false })
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; userId: number | null }>({ show: false, userId: null })

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        } else if (status === "authenticated") {
            fetchUsers()
        }
    }, [status])

    const fetchUsers = async () => {
        const res = await fetch('/api/users')
        if (res.ok) {
            const data = await res.json()
            setUsers(data)
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingId) {
                const res = await fetch(`/api/users/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    alert(error.error || 'Failed to update user')
                    return
                }
                setEditingId(null)
            } else {
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) {
                    const error = await res.json()
                    alert(error.error || 'Failed to create user')
                    return
                }
            }

            setForm({ email: '', password: '', firstName: '', lastName: '', slackId: '', isAdmin: false })
            await fetchUsers()
        } catch (error: any) {
            alert('An error occurred: ' + (error.message || 'Unknown error'))
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            const res = await fetch('/api/users/sync', {
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
                alert(message)
                await fetchUsers()
            } else {
                alert(data.error || 'Failed to sync users')
            }
        } catch (error: any) {
            alert('An error occurred: ' + (error.message || 'Unknown error'))
        } finally {
            setSyncing(false)
        }
    }

    const handleEdit = (user: User) => {
        setForm({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            slackId: user.slackId || '',
            isAdmin: user.isAdmin || false,
            password: '' // Don't populate password for security
        })
        setEditingId(user.id)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setForm({ email: '', password: '', firstName: '', lastName: '', slackId: '', isAdmin: false })
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteConfirm({ show: true, userId: id })
    }

    const confirmDelete = async () => {
        if (deleteConfirm.userId === null) return

        const res = await fetch(`/api/users/${deleteConfirm.userId}`, { method: 'DELETE' })
        if (res.ok) {
            fetchUsers()
        } else {
            alert(await res.text())
        }
        setDeleteConfirm({ show: false, userId: null })
    }

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, userId: null })
    }

    if (status === "loading" || !session) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-slate-900 p-8 font-sans">
            <Head>
                <title>User Management - Slacky Hub</title>
            </Head>

            <div className="max-w-5xl mx-auto space-y-8">
                <Header
                    action={
                        <div className="text-xl font-bold text-slate-100">User Management</div>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Form */}
                    <div className="md:col-span-1">
                        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-8">
                            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <span>{editingId ? '✏️' : '➕'}</span> {editingId ? 'Edit User' : 'Add User'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">First Name <span className="text-red-500">*</span></label>
                                    <input type="text" required className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Name <span className="text-red-500">*</span></label>
                                    <input type="text" required className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                                    <input type="email" className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="optional" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Password {!editingId && <span className="text-red-500">*</span>} {editingId && <span className="text-xs normal-case text-slate-500">(leave blank to keep current)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingId}
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Slack ID</label>
                                    <input
                                        type="text"
                                        placeholder="U12345678"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono"
                                        value={form.slackId}
                                        onChange={e => setForm({ ...form, slackId: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isAdmin"
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                        checked={form.isAdmin}
                                        onChange={e => setForm({ ...form, isAdmin: e.target.checked })}
                                    />
                                    <label htmlFor="isAdmin" className="text-sm text-slate-300">
                                        Admin User
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                        {editingId ? 'Update User' : 'Create User'}
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
                            <span>👥</span> All Users
                        </h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl shadow-sm" />)}
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                                No users found.
                            </div>
                        ) : (
                            users.map(u => (
                                <div key={u.id} className="group bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 flex justify-between items-center hover:shadow-md transition-all">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-lg text-slate-100">{u.firstName} {u.lastName}</p>
                                            {u.isAdmin && (
                                                <span className="px-2 py-1 text-xs font-bold bg-indigo-500 text-white rounded-full">
                                                    ADMIN
                                                </span>
                                            )}
                                        </div>
                                        {u.email && (
                                            <p className="text-slate-500 text-sm font-mono">{u.email}</p>
                                        )}
                                        {u.slackId && (
                                            <p className="text-slate-500 text-xs font-mono">{u.email ? 'Slack: ' : ''}{u.slackId}</p>
                                        )}
                                        {!u.email && !u.slackId && (
                                            <p className="text-slate-500 text-xs italic">No email or Slack ID</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(u)}
                                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                                            title="Edit User"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteClick(e, u.id)}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                            title="Delete User"
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
                                <h3 className="text-xl font-bold text-slate-100">Delete User</h3>
                                <p className="text-slate-500 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to delete this user? All of their data will be permanently removed.
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

            {/* Fixed Sync Button */}
            <button
                onClick={handleSync}
                disabled={syncing}
                className={`fixed bottom-6 right-6 px-6 py-3 rounded-full font-bold text-white transition-all shadow-2xl hover:shadow-3xl active:scale-95 text-sm z-50 ${syncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                    }`}
            >
                {syncing ? 'Syncing...' : 'Sync from Slack'}
            </button>
        </div>
    )
}
