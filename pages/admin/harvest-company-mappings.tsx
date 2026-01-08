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
}

type HarvestCompany = {
    id: number
    harvestId: string
    name?: string
    isActive: boolean
    _count?: {
        invoices: number
        mappings: number
    }
}

type HarvestCompanyMapping = {
    id: number
    hubspotCompanyId: number
    harvestCompanyId: number
    hubspotCompany: HubspotCompany
    harvestCompany: HarvestCompany
    createdAt: string
}

export default function HarvestCompanyMappings() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [mappings, setMappings] = useState<HarvestCompanyMapping[]>([])
    const [hubspotCompanies, setHubspotCompanies] = useState<HubspotCompany[]>([])
    const [harvestCompanies, setHarvestCompanies] = useState<HarvestCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [syncingCompanies, setSyncingCompanies] = useState(false)
    const [search, setSearch] = useState('')
    const [hubspotSearch, setHubspotSearch] = useState('')
    const [harvestSearch, setHarvestSearch] = useState('')
    const [selectedHubspotId, setSelectedHubspotId] = useState<number | null>(null)
    const [selectedHarvestId, setSelectedHarvestId] = useState<number | null>(null)
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
            fetchMappings()
            fetchHubspotCompanies()
            fetchHarvestCompanies()
        }
    }, [status])

    const fetchMappings = async () => {
        try {
            const res = await fetch('/api/harvest-company-mappings')
            if (res.ok) {
                const data = await res.json()
                setMappings(data)
            } else {
                console.error('Failed to fetch mappings:', res.status, res.statusText)
            }
        } catch (error: any) {
            console.error('Error fetching mappings:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchHubspotCompanies = async () => {
        try {
            const res = await fetch('/api/hubspot-companies')
            if (res.ok) {
                const data = await res.json()
                setHubspotCompanies(data)
            }
        } catch (error: any) {
            console.error('Error fetching HubSpot companies:', error)
        }
    }

    const fetchHarvestCompanies = async () => {
        try {
            const res = await fetch('/api/harvest-companies')
            if (res.ok) {
                const data = await res.json()
                setHarvestCompanies(data)
            }
        } catch (error: any) {
            console.error('Error fetching Harvest companies:', error)
        }
    }

    const handleSyncCompanies = async () => {
        setShowSyncConfirm(true)
    }

    const handleConfirmSyncCompanies = async () => {
        setShowSyncConfirm(false)
        setSyncingCompanies(true)
        try {
            const res = await fetch('/api/harvest-companies/sync', {
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
                await fetchHarvestCompanies()
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
            setSyncingCompanies(false)
        }
    }

    const handleCreateMapping = async () => {
        if (!selectedHubspotId || !selectedHarvestId) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Validation Error',
                message: 'Please select both HubSpot and Harvest companies'
            })
            return
        }

        try {
            const res = await fetch('/api/harvest-company-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hubspotCompanyId: selectedHubspotId, harvestCompanyId: selectedHarvestId })
            })
            if (res.ok) {
                await fetchMappings()
                setSelectedHubspotId(null)
                setSelectedHarvestId(null)
                setHubspotSearch('')
                setHarvestSearch('')
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Success',
                    message: 'Mapping created successfully'
                })
            } else {
                const error = await res.json()
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Create Failed',
                    message: error.error || 'Failed to create mapping'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        }
    }

    const handleDeleteMapping = async (hubspotCompanyId: number, harvestCompanyId: number) => {
        try {
            const res = await fetch(`/api/harvest-company-mappings?hubspotCompanyId=${hubspotCompanyId}&harvestCompanyId=${harvestCompanyId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                await fetchMappings()
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Success',
                    message: 'Mapping deleted successfully'
                })
            } else {
                const error = await res.json()
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Delete Failed',
                    message: error.error || 'Failed to delete mapping'
                })
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
        }
    }

    if (status === "loading" || !session) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">Loading...</div>

    // Filter mappings by search
    const filteredMappings = mappings.filter(m => {
        if (!search.trim()) return true
        const searchLower = search.toLowerCase()
        const hubspotName = m.hubspotCompany.name?.toLowerCase() || ''
        const hubspotId = m.hubspotCompany.companyId.toLowerCase()
        const harvestName = m.harvestCompany.name?.toLowerCase() || ''
        const harvestId = m.harvestCompany.harvestId.toLowerCase()
        return hubspotName.includes(searchLower) || 
               hubspotId.includes(searchLower) ||
               harvestName.includes(searchLower) ||
               harvestId.includes(searchLower)
    })

    // Filter companies for dropdowns
    const filteredHubspotCompanies = hubspotCompanies.filter(c => {
        if (!hubspotSearch.trim()) return true
        const searchLower = hubspotSearch.toLowerCase()
        const name = c.name?.toLowerCase() || ''
        const companyId = c.companyId.toLowerCase()
        return name.includes(searchLower) || companyId.includes(searchLower)
    })

    const filteredHarvestCompanies = harvestCompanies.filter(c => {
        if (!harvestSearch.trim()) return true
        const searchLower = harvestSearch.toLowerCase()
        const name = c.name?.toLowerCase() || ''
        const harvestId = c.harvestId.toLowerCase()
        return name.includes(searchLower) || harvestId.includes(searchLower)
    })

    // Get existing mapping pairs to prevent duplicates
    const existingMappingPairs = new Set(
        mappings.map(m => `${m.hubspotCompanyId}-${m.harvestCompanyId}`)
    )
    
    // Check if a specific pair already exists
    const isPairMapped = (hubspotId: number, harvestId: number) => {
        return existingMappingPairs.has(`${hubspotId}-${harvestId}`)
    }
    
    // Get Harvest companies already mapped to the selected HubSpot company
    const getMappedHarvestIdsForHubspot = (hubspotId: number | null) => {
        if (!hubspotId) return new Set<number>()
        return new Set(
            mappings
                .filter(m => m.hubspotCompanyId === hubspotId)
                .map(m => m.harvestCompanyId)
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Head>
                <title>Harvest Company Mappings - Conduit</title>
            </Head>

            <Header />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <span>🔗</span> Harvest Company Mappings
                    </h1>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search mappings..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-48"
                        />
                        <button
                            onClick={handleSyncCompanies}
                            disabled={syncingCompanies}
                            className={`px-4 py-1.5 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${syncingCompanies
                                ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                                }`}
                            title="Sync Harvest companies from Harvest API"
                        >
                            {syncingCompanies ? (
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
                                    <span className="text-sm">Sync Companies</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-8">
                    {/* Form */}
                    <div>
                        <div className="bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700 sticky top-20">
                            <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                                + New Mapping
                            </h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleCreateMapping(); }} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">HubSpot Company <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Search HubSpot companies..."
                                        value={hubspotSearch}
                                        onChange={(e) => setHubspotSearch(e.target.value)}
                                        className="w-full px-4 py-2 mb-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    />
                                    <div className="max-h-48 overflow-y-auto border border-slate-600 rounded-lg bg-slate-900 p-1 space-y-0.5">
                                        {filteredHubspotCompanies.length === 0 ? (
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
                                                        {company.btpAbbreviation && (
                                                            <span className="text-slate-500 ml-1">({company.btpAbbreviation})</span>
                                                        )}
                                                    </span>
                                                </label>
                                            ))}
                                    </div>
                                    {selectedHubspotId && (
                                        <p className="text-xs text-indigo-400 mt-1">
                                            {(() => {
                                                const selected = hubspotCompanies.find(c => c.id === selectedHubspotId)
                                                return selected ? `Selected: ${selected.name || selected.companyId}` : ''
                                            })()}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Harvest Company <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Search Harvest companies..."
                                        value={harvestSearch}
                                        onChange={(e) => setHarvestSearch(e.target.value)}
                                        className="w-full px-4 py-2 mb-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    />
                                    <div className="max-h-48 overflow-y-auto border border-slate-600 rounded-lg bg-slate-900 p-1 space-y-0.5">
                                        {filteredHarvestCompanies.length === 0 ? (
                                            <p className="text-xs text-slate-500 p-1.5">No companies available. <button type="button" onClick={handleSyncCompanies} className="text-indigo-400 hover:underline">Sync companies</button></p>
                                        ) : (() => {
                                            const mappedHarvestForSelected = getMappedHarvestIdsForHubspot(selectedHubspotId)
                                            return filteredHarvestCompanies.map(company => {
                                                const isAlreadyMapped = selectedHubspotId !== null && mappedHarvestForSelected.has(company.id)
                                                const isDuplicatePair = selectedHubspotId !== null && isPairMapped(selectedHubspotId, company.id)
                                                return (
                                                    <label
                                                        key={company.id}
                                                        className={`flex items-center gap-1.5 p-2 rounded hover:bg-slate-800 cursor-pointer ${selectedHarvestId === company.id ? 'bg-indigo-900/30' : ''} ${isDuplicatePair ? 'opacity-50' : ''}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="harvestCompany"
                                                            checked={selectedHarvestId === company.id}
                                                            onChange={() => {
                                                                if (!isDuplicatePair) {
                                                                    setSelectedHarvestId(company.id)
                                                                    setHarvestSearch(company.name || company.harvestId)
                                                                }
                                                            }}
                                                            disabled={isDuplicatePair}
                                                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                        <span className="text-xs text-slate-300 flex-1">
                                                            {company.name || company.harvestId}
                                                            {isDuplicatePair && (
                                                                <span className="text-slate-500 ml-1">(already mapped)</span>
                                                            )}
                                                        </span>
                                                    </label>
                                                )
                                            })
                                        })()}
                                    </div>
                                    {selectedHarvestId && (
                                        <p className="text-xs text-indigo-400 mt-1">
                                            {(() => {
                                                const selected = harvestCompanies.find(c => c.id === selectedHarvestId)
                                                return selected ? `Selected: ${selected.name || selected.harvestId}` : ''
                                            })()}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={!selectedHubspotId || !selectedHarvestId || (selectedHubspotId !== null && selectedHarvestId !== null && isPairMapped(selectedHubspotId, selectedHarvestId))}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {selectedHubspotId !== null && selectedHarvestId !== null && isPairMapped(selectedHubspotId, selectedHarvestId) 
                                        ? 'Mapping Already Exists' 
                                        : 'Create Mapping'}
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
                        ) : filteredMappings.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 text-slate-500">
                                {search ? `No mappings match "${search}"` : 'No mappings found. Create your first mapping!'}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredMappings.map((mapping) => {
                                    // Count how many Harvest companies this HubSpot company is mapped to
                                    const hubspotMappingCount = mappings.filter(
                                        m => m.hubspotCompanyId === mapping.hubspotCompanyId
                                    ).length
                                    
                                    return (
                                        <div key={mapping.id} className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="text-sm font-semibold text-slate-200">
                                                                {mapping.hubspotCompany.name || 'Unnamed HubSpot Company'}
                                                            </div>
                                                            {hubspotMappingCount > 1 && (
                                                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-semibold" title={`This HubSpot company is mapped to ${hubspotMappingCount} Harvest companies`}>
                                                                    {hubspotMappingCount} mappings
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            HubSpot: {mapping.hubspotCompany.companyId}
                                                        </div>
                                                        {mapping.hubspotCompany.btpAbbreviation && (
                                                            <div className="text-xs text-indigo-400 mt-1">
                                                                {mapping.hubspotCompany.btpAbbreviation}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-slate-500">→</div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-semibold text-slate-200 mb-1">
                                                            {mapping.harvestCompany.name || 'Unnamed Harvest Company'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            Harvest: {mapping.harvestCompany.harvestId}
                                                        </div>
                                                        {mapping.harvestCompany._count && (
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {mapping.harvestCompany._count.invoices} invoice{mapping.harvestCompany._count.invoices !== 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteMapping(mapping.hubspotCompanyId, mapping.harvestCompanyId)}
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-900/20 p-2 rounded-lg transition-colors ml-4"
                                                    title="Delete Mapping"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
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
                                <h3 className="text-xl font-bold text-slate-100">Sync Companies</h3>
                                <p className="text-slate-500 text-sm">Update from Harvest</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will fetch and update all company data from Harvest. This might take a moment if there are many companies.
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
                                onClick={handleConfirmSyncCompanies}
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

