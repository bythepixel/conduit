import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { getUserMap } from '../../lib/services/slack/userMappingService'
import { getCadencesForToday } from '../../lib/services/core/cadenceService'
import { 
    createCronLog, 
    updateCronLogMappingsFound, 
    updateCronLogCompleted,
    finalizeCronLog,
    updateCronLogFailed,
    createErrorCronLog
} from '../../lib/services/core/cronLogService'
import { fetchMappingsForSync } from '../../lib/services/core/mappingService'
import { processMapping } from '../../lib/services/core/mappingSyncService'

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
                console.error('[CRON] Unauthorized: Missing or invalid CRON_SECRET')
                return res.status(401).json({ error: 'Unauthorized' })
            }
        }
        // Log cron execution
        console.log('[CRON] Cron job triggered', {
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
    let cronLogId: number | null = null

    try {
        const { mappingId, test } = req.body || {}
        
        // Create cron log entry if this is a cron call
        let cadenceResult: any = null
        
        if (isCronCall) {
            cadenceResult = getCadencesForToday()
            
            // Create cron log entry
            cronLogId = await createCronLog(cadenceResult)
            
            if (!cadenceResult.shouldSync) {
                console.log(`[CRON] No mappings should sync today (Day: ${cadenceResult.dayOfWeek}, Date: ${cadenceResult.dayOfMonth}/${cadenceResult.lastDayOfMonth})`)
                
                // Update cron log if it was created
                if (cronLogId) {
                    try {
                        await updateCronLogCompleted(cronLogId)
                    } catch (updateError: any) {
                        console.error('[CRON LOG] Failed to update cron log:', updateError)
                    }
                }
                
                return res.status(200).json({ 
                    message: 'No mappings scheduled for sync today', 
                    results: [],
                    cadence: {
                        dayOfWeek: cadenceResult.dayOfWeek,
                        dayOfMonth: cadenceResult.dayOfMonth,
                        lastDayOfMonth: cadenceResult.lastDayOfMonth
                    }
                })
            }
        }
        
        // Fetch mappings for sync
        const mappings = await fetchMappingsForSync(mappingId ? Number(mappingId) : undefined, cadenceResult)
        
        // Update cron log with mappings found
        if (isCronCall && cronLogId) {
            try {
                await updateCronLogMappingsFound(cronLogId, mappings.length)
            } catch (updateError: any) {
                console.error('[CRON LOG] Failed to update mappings found:', updateError)
            }
        }
        
        const results = []
        const isTestMode = test === true
        const mappingStatuses: Map<number, { success: boolean; error?: string }> = new Map()

        // Fetch active prompt once for all mappings
        const activePrompt = await prisma.prompt.findFirst({
            where: { isActive: true }
        })
        const systemPrompt = activePrompt?.content || undefined

        // Fetch user map once for all mappings
        const userMap = await getUserMap()

        // Process each mapping
        for (let i = 0; i < mappings.length; i++) {
            const mapping = mappings[i]
            
            // Process the mapping
            const syncResult = await processMapping(
                mapping,
                systemPrompt,
                userMap,
                isTestMode
            )
            
            // Add results to the overall results array
            results.push(...syncResult.results)
            
            // Track mapping status for cron log
            if (isCronCall && cronLogId) {
                mappingStatuses.set(mapping.id, {
                    success: syncResult.success,
                    error: syncResult.error
                })
            }
            
            // Delay 2 seconds between mappings (except after the last one)
            if (i < mappings.length - 1) {
                console.log(`[SYNC] Waiting 2 seconds before processing next mapping...`)
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        // Update cron log with execution results
        if (isCronCall && cronLogId) {
            try {
                await finalizeCronLog(cronLogId, mappingStatuses)
            } catch (error: any) {
                console.error('[CRON LOG] Failed to finalize cron log:', error)
            }
        }

        return res.status(200).json({ message: 'Sync process completed', results })

    } catch (error: any) {
        console.error('[CRON] Sync Error:', error)
        console.error('[CRON] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            isCronCall,
            cronLogId
        })
        
        // Update cron log with error if it exists
        if (isCronCall) {
            if (cronLogId) {
                try {
                    await updateCronLogFailed(cronLogId, error.message || 'Internal Server Error')
                } catch (updateError: any) {
                    console.error('[CRON LOG] Failed to update cron log with error:', updateError)
                }
            } else {
                // Try to create a cron log entry even if we're in error state
                await createErrorCronLog(error.message || 'Internal Server Error')
            }
        }
        
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
