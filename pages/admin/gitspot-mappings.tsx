import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import Header from '../../components/Header'
import ErrorModal from '../../components/ErrorModal'
import { useAuthGuard } from '../../lib/hooks/useAuthGuard'
import { useApiCall } from '../../lib/hooks/useApiCall'

type HubspotCompany = {
  id: number
  companyId: string
  name?: string
  btpAbbreviation?: string
  activeClient: boolean
}

type GitHubRepository = {
  id: number
  githubId: string
  fullName: string
  ownerLogin?: string | null
  htmlUrl?: string | null
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
}

type GitSpotCompanyMapping = {
  id: number
  hubspotCompanyId: number
  githubRepositoryId: number
  hubspotCompany: HubspotCompany
  githubRepository: GitHubRepository
  lastReleaseId?: string | null
  lastReleaseTagName?: string | null
  lastReleasePublishedAt?: string | null
  createdAt: string
}

export default function GitSpotMappingsPage() {
  const { isLoading } = useAuthGuard()
  const { modalConfig, setModalConfig, closeModal } = useApiCall()

  const [mappings, setMappings] = useState<GitSpotCompanyMapping[]>([])
  const [hubspotCompanies, setHubspotCompanies] = useState<HubspotCompany[]>([])
  const [repos, setRepos] = useState<GitHubRepository[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [hubspotSearch, setHubspotSearch] = useState('')
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedHubspotId, setSelectedHubspotId] = useState<number | null>(null)
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([])

  const [syncingRepos, setSyncingRepos] = useState(false)
  const [syncingReleases, setSyncingReleases] = useState(false)
  const [showSyncReposConfirm, setShowSyncReposConfirm] = useState(false)
  const [showSyncReleasesConfirm, setShowSyncReleasesConfirm] = useState(false)

  const mappedHubspotCompanyIds = useMemo(() => {
    return new Set(mappings.map(m => m.hubspotCompanyId))
  }, [mappings])

  useEffect(() => {
    if (!isLoading) {
      void Promise.all([fetchMappings(), fetchHubspotCompanies(), fetchRepos()]).finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const fetchMappings = async () => {
    const res = await fetch('/api/gitspot-mappings')
    if (res.ok) setMappings(await res.json())
  }

  const fetchHubspotCompanies = async () => {
    const res = await fetch('/api/hubspot-companies')
    if (res.ok) setHubspotCompanies(await res.json())
  }

  const fetchRepos = async () => {
    const res = await fetch('/api/github-repositories')
    if (res.ok) setRepos(await res.json())
  }

  const existingPairs = useMemo(() => new Set(mappings.map(m => `${m.hubspotCompanyId}-${m.githubRepositoryId}`)), [mappings])
  const isPairMapped = (hubspotId: number | null, repoId: number | null) => {
    if (!hubspotId || !repoId) return false
    return existingPairs.has(`${hubspotId}-${repoId}`)
  }

  const getMappedRepoIdsForHubspot = (hubspotId: number | null) => {
    if (!hubspotId) return new Set<number>()
    return new Set(mappings.filter(m => m.hubspotCompanyId === hubspotId).map(m => m.githubRepositoryId))
  }

  const filteredMappings = mappings.filter(m => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      (m.hubspotCompany.name || '').toLowerCase().includes(s) ||
      (m.hubspotCompany.companyId || '').toLowerCase().includes(s) ||
      (m.githubRepository.fullName || '').toLowerCase().includes(s)
    )
  })

  const groupedMappings = useMemo(() => {
    const map = new Map<number, { hubspotCompany: HubspotCompany; mappings: GitSpotCompanyMapping[] }>()
    for (const m of filteredMappings) {
      const existing = map.get(m.hubspotCompanyId)
      if (existing) {
        existing.mappings.push(m)
      } else {
        map.set(m.hubspotCompanyId, { hubspotCompany: m.hubspotCompany, mappings: [m] })
      }
    }
    // Sort: active clients first, then by name/companyId. Inside each company, sort repos by fullName.
    return Array.from(map.values())
      .map(group => ({
        ...group,
        mappings: group.mappings.slice().sort((a, b) => (a.githubRepository.fullName || '').localeCompare(b.githubRepository.fullName || '')),
      }))
      .sort((a, b) => {
        const aActive = a.hubspotCompany.activeClient ? 1 : 0
        const bActive = b.hubspotCompany.activeClient ? 1 : 0
        if (aActive !== bActive) return bActive - aActive
        const aName = (a.hubspotCompany.name || a.hubspotCompany.companyId || '').toLowerCase()
        const bName = (b.hubspotCompany.name || b.hubspotCompany.companyId || '').toLowerCase()
        return aName.localeCompare(bName)
      })
  }, [filteredMappings])

  const filteredHubspotCompanies = hubspotCompanies.filter(c => {
    if (!hubspotSearch.trim()) return true
    const s = hubspotSearch.toLowerCase()
    return ((c.name || '').toLowerCase().includes(s) || c.companyId.toLowerCase().includes(s) || (c.btpAbbreviation || '').toLowerCase().includes(s))
  })

  const filteredRepos = repos.filter(r => {
    if (!repoSearch.trim()) return true
    const s = repoSearch.toLowerCase()
    return (r.fullName || '').toLowerCase().includes(s) || (r.ownerLogin || '').toLowerCase().includes(s)
  })

  const handleRepoToggle = (repoId: number) => {
    setSelectedRepoIds(prev => (prev.includes(repoId) ? prev.filter(id => id !== repoId) : [...prev, repoId]))
  }

  const handleCreateMapping = async () => {
    if (!selectedHubspotId || selectedRepoIds.length === 0) {
      setModalConfig({ isOpen: true, type: 'error', title: 'Validation Error', message: 'Please select a HubSpot company and at least one GitHub repository' })
      return
    }

    const res = await fetch('/api/gitspot-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hubspotCompanyId: selectedHubspotId, githubRepositoryIds: selectedRepoIds }),
    })
    const data = await res.json()
    if (res.ok) {
      await fetchMappings()
      setSelectedRepoIds([])
      setRepoSearch('')
      const created = data?.results?.created ?? 0
      const skipped = data?.results?.skipped ?? 0
      const errorCount = data?.results?.errors?.length ?? 0
      let message = `Created: ${created}\nSkipped: ${skipped}`
      if (errorCount > 0) {
        message += `\nErrors: ${errorCount}`
        if (errorCount <= 10) {
          message += '\n\n' + data.results.errors.join('\n')
        }
      }
      setModalConfig({ isOpen: true, type: errorCount > 0 ? 'info' : 'success', title: 'Mapping Results', message })
    } else {
      setModalConfig({ isOpen: true, type: 'error', title: 'Create Failed', message: data.error || 'Failed to create mapping' })
    }
  }

  const handleDeleteMapping = async (hubspotCompanyId: number, githubRepositoryId: number) => {
    const res = await fetch(`/api/gitspot-mappings?hubspotCompanyId=${hubspotCompanyId}&githubRepositoryId=${githubRepositoryId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      await fetchMappings()
      setModalConfig({ isOpen: true, type: 'success', title: 'Success', message: 'Mapping deleted successfully' })
    } else {
      setModalConfig({ isOpen: true, type: 'error', title: 'Delete Failed', message: data.error || 'Failed to delete mapping' })
    }
  }

  const handleConfirmSyncRepos = async () => {
    setShowSyncReposConfirm(false)
    setSyncingRepos(true)
    try {
      const res = await fetch('/api/github-repositories/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (res.ok) {
        await fetchRepos()
        setModalConfig({
          isOpen: true,
          type: (data.results.errors?.length || 0) > 0 ? 'info' : 'success',
          title: 'Repo Sync Results',
          message: `Sync completed!\nCreated: ${data.results.created}\nUpdated: ${data.results.updated}\nErrors: ${data.results.errors?.length || 0}`,
        })
      } else {
        setModalConfig({ isOpen: true, type: 'error', title: 'Repo Sync Failed', message: data.error || 'Failed to sync repositories' })
      }
    } finally {
      setSyncingRepos(false)
    }
  }

  const handleConfirmSyncReleases = async () => {
    setShowSyncReleasesConfirm(false)
    setSyncingReleases(true)
    try {
      const res = await fetch('/api/gitspot/sync-releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (res.ok) {
        await fetchMappings()
        setModalConfig({
          isOpen: true,
          type: (data.results.errors?.length || 0) > 0 ? 'info' : 'success',
          title: 'Release Sync Results',
          message: `Release sync completed!\nMappings: ${data.results.mappingsProcessed}\nNotes created: ${data.results.notesCreated}\nSkipped: ${data.results.skipped}\nErrors: ${data.results.errors?.length || 0}`,
        })
      } else {
        setModalConfig({ isOpen: true, type: 'error', title: 'Release Sync Failed', message: data.error || 'Failed to sync releases' })
      }
    } finally {
      setSyncingReleases(false)
    }
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      <Head>
        <title>GitSpot Mappings - Conduit</title>
      </Head>

      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>🔗</span> GitSpot Company ↔ Repo Mappings
          </h1>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search mappings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-56"
            />
            <button
              onClick={() => setShowSyncReposConfirm(true)}
              disabled={syncingRepos}
              className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                syncingRepos ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              }`}
              title="Sync repositories from GitHub"
            >
              {syncingRepos ? 'Syncing repos...' : 'Sync Repos'}
            </button>
            <button
              onClick={() => setShowSyncReleasesConfirm(true)}
              disabled={syncingReleases}
              className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                syncingReleases ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
              }`}
              title="Post new GitHub releases to HubSpot as company notes"
            >
              {syncingReleases ? 'Syncing releases...' : 'Sync Releases'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-8">
          {/* Form */}
          <div>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-20">
              <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">+ New Mapping</h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleCreateMapping()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    HubSpot Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search HubSpot companies..."
                    value={hubspotSearch}
                    onChange={(e) => setHubspotSearch(e.target.value)}
                    className="w-full px-4 py-2 mb-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                  <div className="max-h-48 overflow-y-auto border border-slate-600 rounded-lg bg-slate-900 p-1 space-y-0.5">
                    {hubspotCompanies.length === 0 ? (
                      <p className="text-xs text-slate-500 p-1.5">No companies available</p>
                    ) : filteredHubspotCompanies.map(company => (
                      <label
                        key={company.id}
                        className={`flex items-center gap-1.5 p-2 rounded hover:bg-slate-800 cursor-pointer ${selectedHubspotId === company.id ? 'bg-indigo-900/30' : ''}`}
                      >
                        <input
                          type="radio"
                          name="hubspotCompany"
                          checked={selectedHubspotId === company.id}
                          onChange={() => {
                            setSelectedHubspotId(company.id)
                            setHubspotSearch(company.name || company.companyId)
                          }}
                          className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-300 flex-1">
                          {company.name || company.companyId}
                          {company.btpAbbreviation && <span className="text-slate-500 ml-1">({company.btpAbbreviation})</span>}
                        </span>
                        {mappedHubspotCompanyIds.has(company.id) && (
                          <span
                            className="text-green-400 text-xs font-semibold"
                            title="This company already has at least one GitSpot mapping"
                          >
                            ✓
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    GitHub Repository <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="w-full px-4 py-2 mb-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                  <div className="max-h-48 overflow-y-auto border border-slate-600 rounded-lg bg-slate-900 p-1 space-y-0.5">
                    {repos.length === 0 ? (
                      <p className="text-xs text-slate-500 p-1.5">
                        No repos available. <button type="button" onClick={() => setShowSyncReposConfirm(true)} className="text-indigo-400 hover:underline">Sync repos</button>
                      </p>
                    ) : (() => {
                      const mappedRepoIds = getMappedRepoIdsForHubspot(selectedHubspotId)
                      if (filteredRepos.length === 0) {
                        return <p className="text-xs text-slate-500 p-1.5">No repositories match "{repoSearch}"</p>
                      }
                      return filteredRepos.map(repo => {
                      const alreadyMappedForCompany = mappedRepoIds.has(repo.id)
                      const checked = selectedRepoIds.includes(repo.id)
                      return (
                        <label
                          key={repo.id}
                          className={`flex items-center gap-1.5 p-1 rounded hover:bg-slate-800 cursor-pointer ${checked ? 'bg-indigo-900/30' : ''} ${alreadyMappedForCompany ? 'opacity-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!selectedHubspotId) {
                                setModalConfig({ isOpen: true, type: 'info', title: 'Select a Company', message: 'Select a HubSpot company first, then choose repositories.' })
                                return
                              }
                              if (!alreadyMappedForCompany) {
                                handleRepoToggle(repo.id)
                              }
                            }}
                            disabled={!selectedHubspotId || alreadyMappedForCompany}
                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="text-xs text-slate-300 flex-1">
                            {repo.fullName}
                            {repo.isArchived && <span className="text-slate-500 ml-1">(archived)</span>}
                            {alreadyMappedForCompany && <span className="text-slate-500 ml-1">(already mapped)</span>}
                          </span>
                        </label>
                      )
                    })
                    })()}
                  </div>
                  {selectedRepoIds.length > 0 && (
                    <p className="text-xs text-indigo-400 mt-1">
                      {selectedRepoIds.length} repo{selectedRepoIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!selectedHubspotId || selectedRepoIds.length === 0}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Mapping{selectedRepoIds.length !== 1 ? 's' : ''}
                </button>
              </form>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl shadow-sm" />)}
              </div>
            ) : groupedMappings.length === 0 ? (
              <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                {search ? `No mappings match "${search}"` : 'No mappings found. Create your first mapping!'}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedMappings.map(group => (
                  <div key={group.hubspotCompany.id} className={`bg-slate-800 rounded-2xl shadow-sm border p-6 ${
                    group.hubspotCompany.activeClient ? 'border-green-700/50 bg-green-900/20' : 'border-slate-700'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold text-slate-200 truncate">
                            {group.hubspotCompany.name || 'Unnamed HubSpot Company'}
                          </div>
                          {group.hubspotCompany.btpAbbreviation && (
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold">
                              {group.hubspotCompany.btpAbbreviation}
                            </span>
                          )}
                          {group.hubspotCompany.activeClient && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs font-semibold">
                              Active
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-600/40 text-slate-300 rounded text-xs font-semibold">
                            {group.mappings.length} repo{group.mappings.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1">
                          HubSpot: {group.hubspotCompany.companyId}
                        </div>

                        <div className="mt-4 space-y-2">
                          {group.mappings.map(m => (
                            <div key={`${m.hubspotCompanyId}-${m.githubRepositoryId}`} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-700 bg-slate-900/40">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-200 truncate">
                                  {m.githubRepository.htmlUrl ? (
                                    <a className="hover:underline" href={m.githubRepository.htmlUrl} target="_blank" rel="noreferrer">
                                      {m.githubRepository.fullName}
                                    </a>
                                  ) : (
                                    m.githubRepository.fullName
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  GitHub: {m.githubRepository.githubId}
                                </div>
                                {(m.lastReleaseTagName || m.lastReleasePublishedAt) && (
                                  <div className="text-xs text-slate-400 mt-1">
                                    Last posted: <span className="font-mono">{m.lastReleaseTagName || 'release'}</span>
                                    {m.lastReleasePublishedAt ? ` @ ${new Date(m.lastReleasePublishedAt).toLocaleString()}` : ''}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => void handleDeleteMapping(m.hubspotCompanyId, m.githubRepositoryId)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors flex-shrink-0"
                                title="Delete Mapping"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync repos confirmation */}
      {showSyncReposConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSyncReposConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-xl">🐙</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Sync GitHub Repositories</h3>
                <p className="text-slate-500 text-sm">Update repo list from GitHub</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              This will sync repositories from GitHub into Conduit. You’ll need <span className="font-mono">GITHUB_TOKEN</span> configured (and optionally <span className="font-mono">GITHUB_ORG</span>).
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSyncReposConfirm(false)} className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95">
                Cancel
              </button>
              <button type="button" onClick={() => void handleConfirmSyncRepos()} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all active:scale-95">
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync releases confirmation */}
      {showSyncReleasesConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSyncReleasesConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 text-xl">📝</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Sync Releases → HubSpot Notes</h3>
                <p className="text-slate-500 text-sm">Posts new releases as company notes</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              This will check each mapped repo for new releases and post them to the mapped HubSpot company as notes.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSyncReleasesConfirm(false)} className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-all active:scale-95">
                Cancel
              </button>
              <button type="button" onClick={() => void handleConfirmSyncReleases()} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all active:scale-95">
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

