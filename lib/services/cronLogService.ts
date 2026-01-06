import { prisma } from '../prisma'
import { CadenceFilterResult } from './cadenceService'

export interface CronLogMappingStatus {
    success: boolean
    error?: string
}

/**
 * Creates a new cron log entry
 */
export async function createCronLog(
    cadenceResult: CadenceFilterResult
): Promise<number | null> {
    try {
        console.log('[CRON LOG] Creating cron log entry...')
        const cronLog = await prisma.cronLog.create({
            data: {
                status: 'running',
                cadences: cadenceResult.cadences || [],
                dayOfWeek: cadenceResult.dayOfWeek,
                dayOfMonth: cadenceResult.dayOfMonth,
                lastDayOfMonth: cadenceResult.lastDayOfMonth,
                mappingsFound: 0,
                mappingsExecuted: 0,
                mappingsFailed: 0,
            }
        })
        console.log(`[CRON LOG] Created cron log entry with ID: ${cronLog.id}`)
        return cronLog.id
    } catch (logError: any) {
        console.error('[CRON LOG] Failed to create cron log entry:', logError)
        console.error('[CRON LOG] Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
        })
        return null
    }
}

/**
 * Updates the cron log with the number of mappings found
 */
export async function updateCronLogMappingsFound(
    cronLogId: number,
    count: number
): Promise<void> {
    try {
        await prisma.cronLog.update({
            where: { id: cronLogId },
            data: { mappingsFound: count }
        })
        console.log(`[CRON LOG] Updated cron log ${cronLogId} with ${count} mappings found`)
    } catch (updateError: any) {
        console.error('[CRON LOG] Failed to update mappings found:', updateError)
        throw updateError
    }
}

/**
 * Updates the cron log status to completed with no mappings
 */
export async function updateCronLogCompleted(
    cronLogId: number
): Promise<void> {
    try {
        await prisma.cronLog.update({
            where: { id: cronLogId },
            data: {
                status: 'completed',
                completedAt: new Date(),
            }
        })
        console.log(`[CRON LOG] Updated cron log ${cronLogId} to completed`)
    } catch (updateError: any) {
        console.error('[CRON LOG] Failed to update cron log:', updateError)
        throw updateError
    }
}

/**
 * Finalizes the cron log with execution results
 */
export async function finalizeCronLog(
    cronLogId: number,
    mappingStatuses: Map<number, CronLogMappingStatus>
): Promise<void> {
    let mappingsExecuted = 0
    let mappingsFailed = 0
    
    // Create cron log mapping entries and count successes/failures
    const mappingEntries = Array.from(mappingStatuses.entries())
    for (const [mappingId, status] of mappingEntries) {
        try {
            await prisma.cronLogMapping.create({
                data: {
                    cronLogId: cronLogId,
                    mappingId: mappingId,
                    status: status.success ? 'success' : 'failed',
                    errorMessage: status.error || null,
                }
            })
            
            if (status.success) {
                mappingsExecuted++
            } else {
                mappingsFailed++
            }
        } catch (mappingLogError: any) {
            console.error(`[CRON LOG] Failed to create mapping log entry for mapping ${mappingId}:`, mappingLogError)
            // Continue processing other mappings
        }
    }
    
    // Update cron log with final status
    try {
        await prisma.cronLog.update({
            where: { id: cronLogId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                mappingsExecuted: mappingsExecuted,
                mappingsFailed: mappingsFailed,
            }
        })
        console.log(`[CRON LOG] Updated cron log ${cronLogId} with final status (${mappingsExecuted} executed, ${mappingsFailed} failed)`)
    } catch (updateError: any) {
        console.error('[CRON LOG] Failed to update cron log with final status:', updateError)
        throw updateError
    }
}

/**
 * Updates the cron log with error status
 */
export async function updateCronLogFailed(
    cronLogId: number,
    errorMessage: string
): Promise<void> {
    try {
        await prisma.cronLog.update({
            where: { id: cronLogId },
            data: {
                status: 'failed',
                completedAt: new Date(),
                errorMessage: errorMessage,
            }
        })
        console.log(`[CRON LOG] Updated cron log ${cronLogId} with error status`)
    } catch (updateError: any) {
        console.error('[CRON LOG] Failed to update cron log with error:', updateError)
        throw updateError
    }
}

/**
 * Creates an error cron log entry when sync fails before creating initial log
 */
export async function createErrorCronLog(
    errorMessage: string
): Promise<number | null> {
    try {
        console.log('[CRON LOG] Creating error log entry for failed sync...')
        const errorLog = await prisma.cronLog.create({
            data: {
                status: 'failed',
                completedAt: new Date(),
                errorMessage: errorMessage,
                cadences: [],
                mappingsFound: 0,
                mappingsExecuted: 0,
                mappingsFailed: 0,
            }
        })
        console.log(`[CRON LOG] Created error log entry with ID: ${errorLog.id}`)
        return errorLog.id
    } catch (createError: any) {
        console.error('[CRON LOG] CRITICAL: Failed to create error log entry:', createError)
        return null
    }
}





