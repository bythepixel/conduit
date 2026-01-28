import Head from 'next/head'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'
import { useAuthGuard } from '../../lib/hooks/useAuthGuard'
import { useApiCall } from '../../lib/hooks/useApiCall'
import { formatSyncResults } from '../../lib/utils/formatHelpers'

type GitHubRepository = {
  id: number
  githubId: string
  fullName: string
  name?: string | null
  ownerLogin?: string | null
  htmlUrl?: string | null
  description?: string | null
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
  defaultBranch?: string | null
  pushedAt?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    mappings: number
  }
}

export default function GitHubRepositoriesPage() {
  const { isLoading } = useAuthGuard()
  const { modalConfig, setModalConfig, closeModal } = useApiCall()

  const [repos, setRepos] = useState<GitHubRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      fetchRepos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/github-repositories')
      if (res.ok) {
        setRepos(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => setShowSyncConfirm(true)

  const handleConfirmSync = async () => {
    setShowSyncConfirm(false)
    setSyncing(true)
    try {
      const res = await fetch('/api/github-repositories/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        const message = formatSyncResults(data.results)
        setModalConfig({
          isOpen: true,
          type: (data.results.errors?.length || 0) > 0 ? 'info' : 'success',
          title: 'Sync Results',
          message,
        })
        await fetchRepos()
      } else {
        setModalConfig({
          isOpen: true,
          type: 'error',
          title: 'Sync Failed',
          message: data.error || 'Failed to sync GitHub repositories',
        })
      }
    } catch (e: any) {
      setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Sync Error',
        message: e.message || 'Unknown error',
      })
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <div>Loading...</div>

  const filtered = repos.filter(r => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      (r.fullName || '').toLowerCase().includes(s) ||
      (r.ownerLogin || '').toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s)
    )
  })

  const activeRepos = filtered.filter(r => !r.isArchived)
  const archivedRepos = filtered.filter(r => r.isArchived)

  const renderRepoCard = (r: GitHubRepository) => (
    <div
      key={r.id}
      className={`group p-4 rounded-lg shadow-sm border hover:shadow-md transition-all ${
        r.isArchived ? 'bg-slate-800/60 border-slate-700 opacity-80' : 'bg-slate-800 border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-slate-100 truncate">
              {r.htmlUrl ? (
                <a className="hover:underline" href={r.htmlUrl} target="_blank" rel="noreferrer">
                  {r.fullName}
                </a>
              ) : (
                r.fullName
              )}
            </div>
            {r.isPrivate && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">
                Private
              </span>
            )}
            {r.isFork && (
              <span className="px-2 py-0.5 bg-slate-600/40 text-slate-300 rounded text-xs font-semibold">
                Fork
              </span>
            )}
            {r.isArchived && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-semibold">
                Archived
              </span>
            )}
            {r._count && r._count.mappings > 0 && (
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold">
                {r._count.mappings} mapping{r._count.mappings !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {r.description && <div className="text-sm text-slate-400 mt-1 line-clamp-2">{r.description}</div>}
          <div className="text-xs text-slate-500 font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>id: {r.githubId}</span>
            {r.defaultBranch && <span>branch: {r.defaultBranch}</span>}
            {r.pushedAt && <span>pushed: {new Date(r.pushedAt).toLocaleString()}</span>}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      <Head>
        <title>GitHub Repositories - Conduit</title>
      </Head>

      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>🐙</span> GitHub Repositories
          </h1>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search repos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-56"
            />
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                syncing ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              }`}
              title="Sync repositories from GitHub"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 bg-slate-800 rounded-lg shadow-sm" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
            {search ? `No repositories match "${search}"` : 'No repositories found. Click Sync to import from GitHub.'}
          </div>
        ) : (
          <div className="space-y-8">
            {activeRepos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                  <span>✅</span> Active Repositories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{activeRepos.map(renderRepoCard)}</div>
              </div>
            )}
            {archivedRepos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                  <span>🗄️</span> Archived Repositories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{archivedRepos.map(renderRepoCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync Confirmation Modal */}
      {showSyncConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSyncConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-xl">🐙</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Sync GitHub Repositories</h3>
                <p className="text-slate-500 text-sm">Fetch from GitHub</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              This will fetch repositories from GitHub and upsert them into Conduit. You’ll need <span className="font-mono">GITHUB_TOKEN</span> configured.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSyncConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95"
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

      <ErrorModal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} />
    </div>
  )
}

