import type { NextApiRequest, NextApiResponse } from 'next'

// Force dynamic execution to prevent caching issues with Vercel cron jobs
export const dynamic = 'force-dynamic'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle Vercel Cron (GET)
    // Vercel cron jobs send x-vercel-cron header automatically
    const isVercelCron = req.headers['x-vercel-cron'] === '1'
    
    if (req.method === 'GET') {
        // If CRON_SECRET is set, verify it matches (unless it's a Vercel cron)
        if (process.env.CRON_SECRET && !isVercelCron) {
            const authHeader = req.headers.authorization || ''
            const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
            if (authHeader !== expectedAuth) {
                console.error('[CRON ALL] Unauthorized: Missing or invalid CRON_SECRET')
                return res.status(401).json({ error: 'Unauthorized' })
            }
        }
        // Log cron execution
        console.log('[CRON ALL] Master cron job triggered', {
            isVercelCron,
            hasAuth: !!req.headers.authorization,
            hasVercelHeader: !!req.headers['x-vercel-cron']
        })
    } else if (req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    // Determine if this is a cron call (GET) or manual call (POST)
    const isCronCall = req.method === 'GET'

    const results = {
        syncData: null as any,
        sync: null as any,
        harvestInvoices: null as any,
        errors: [] as string[]
    }

    // Determine base URL for internal API calls
    // For Vercel, use the VERCEL_URL if available, otherwise use localhost
    const getBaseUrl = () => {
        if (process.env.VERCEL_URL) {
            return `https://${process.env.VERCEL_URL}`
        }
        if (process.env.NEXT_PUBLIC_APP_URL) {
            return process.env.NEXT_PUBLIC_APP_URL
        }
        return 'http://localhost:3000'
    }

    const baseUrl = getBaseUrl()

    // Prepare headers for internal API calls
    const getHeaders = () => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }
        
        // Pass through Vercel cron header if present
        if (isVercelCron) {
            headers['x-vercel-cron'] = '1'
        }
        
        // Add authorization if CRON_SECRET is set and this is a cron call
        if (isCronCall && process.env.CRON_SECRET) {
            headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`
        }
        
        return headers
    }

    const headers = getHeaders()

    try {
        // Step 1: Run sync-data
        console.log('[CRON ALL] Step 1: Running sync-data...')
        try {
            const syncDataUrl = `${baseUrl}/api/sync-data`
            const syncDataResponse = await fetch(syncDataUrl, {
                method: 'GET',
                headers
            })
            
            if (syncDataResponse.ok) {
                results.syncData = await syncDataResponse.json()
                console.log('[CRON ALL] Step 1 completed: sync-data', results.syncData)
            } else {
                const errorData = await syncDataResponse.json().catch(() => ({ error: 'Unknown error' }))
                const errorMsg = `sync-data failed: ${syncDataResponse.status} - ${errorData.error || 'Unknown error'}`
                results.errors.push(errorMsg)
                console.error(`[CRON ALL] ${errorMsg}`)
            }
        } catch (error: any) {
            const errorMsg = `sync-data error: ${error.message || 'Unknown error'}`
            results.errors.push(errorMsg)
            console.error(`[CRON ALL] ${errorMsg}`, error)
        }

        // Step 2: Run sync (SlackyHub sync)
        console.log('[CRON ALL] Step 2: Running sync...')
        try {
            const syncUrl = `${baseUrl}/api/sync`
            const syncResponse = await fetch(syncUrl, {
                method: 'GET',
                headers
            })
            
            if (syncResponse.ok) {
                results.sync = await syncResponse.json()
                console.log('[CRON ALL] Step 2 completed: sync', results.sync)
            } else {
                const errorData = await syncResponse.json().catch(() => ({ error: 'Unknown error' }))
                const errorMsg = `sync failed: ${syncResponse.status} - ${errorData.error || 'Unknown error'}`
                results.errors.push(errorMsg)
                console.error(`[CRON ALL] ${errorMsg}`)
            }
        } catch (error: any) {
            const errorMsg = `sync error: ${error.message || 'Unknown error'}`
            results.errors.push(errorMsg)
            console.error(`[CRON ALL] ${errorMsg}`, error)
        }

        // Step 3: Run harvest-invoices sync
        console.log('[CRON ALL] Step 3: Running harvest-invoices sync...')
        try {
            const harvestUrl = `${baseUrl}/api/harvest-invoices/sync`
            const harvestResponse = await fetch(harvestUrl, {
                method: 'GET',
                headers
            })
            
            if (harvestResponse.ok) {
                results.harvestInvoices = await harvestResponse.json()
                console.log('[CRON ALL] Step 3 completed: harvest-invoices sync', results.harvestInvoices)
            } else {
                const errorData = await harvestResponse.json().catch(() => ({ error: 'Unknown error' }))
                const errorMsg = `harvest-invoices sync failed: ${harvestResponse.status} - ${errorData.error || 'Unknown error'}`
                results.errors.push(errorMsg)
                console.error(`[CRON ALL] ${errorMsg}`)
            }
        } catch (error: any) {
            const errorMsg = `harvest-invoices sync error: ${error.message || 'Unknown error'}`
            results.errors.push(errorMsg)
            console.error(`[CRON ALL] ${errorMsg}`, error)
        }

        // Return combined results
        const hasErrors = results.errors.length > 0
        return res.status(hasErrors ? 207 : 200).json({
            message: 'All cron jobs completed',
            results,
            success: !hasErrors
        })
    } catch (error: any) {
        console.error('[CRON ALL] Fatal error:', error)
        return res.status(500).json({
            error: 'Fatal error in master cron job',
            message: error.message || 'Unknown error',
            results
        })
    }
}

