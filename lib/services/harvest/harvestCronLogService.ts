import { prisma } from '../../prisma'

/**
 * Creates a new Harvest invoice cron log entry
 */
export async function createHarvestInvoiceCronLog(): Promise<number | null> {
    try {
        console.log('[HARVEST CRON LOG] Creating cron log entry...')
        const cronLog = await prisma.harvestInvoiceCronLog.create({
            data: {
                status: 'running',
                invoicesFound: 0,
                invoicesCreated: 0,
                invoicesUpdated: 0,
                invoicesFailed: 0,
                errors: [],
            }
        })
        console.log(`[HARVEST CRON LOG] Created cron log entry with ID: ${cronLog.id}`)
        return cronLog.id
    } catch (logError: any) {
        console.error('[HARVEST CRON LOG] Failed to create cron log entry:', logError)
        return null
    }
}

/**
 * Updates the cron log with the number of invoices found
 */
export async function updateHarvestInvoiceCronLogInvoicesFound(
    cronLogId: number,
    count: number
): Promise<void> {
    try {
        await prisma.harvestInvoiceCronLog.update({
            where: { id: cronLogId },
            data: { invoicesFound: count }
        })
    } catch (updateError: any) {
        console.error('[HARVEST CRON LOG] Failed to update invoices found:', updateError)
        throw updateError
    }
}

/**
 * Finalizes the cron log with execution results
 */
export async function finalizeHarvestInvoiceCronLog(
    cronLogId: number,
    results: {
        created: number
        updated: number
        errors: string[]
    }
): Promise<void> {
    try {
        await prisma.harvestInvoiceCronLog.update({
            where: { id: cronLogId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                invoicesCreated: results.created,
                invoicesUpdated: results.updated,
                invoicesFailed: results.errors.length,
                errors: results.errors,
            }
        })
        console.log(`[HARVEST CRON LOG] Updated cron log ${cronLogId} with final status`)
    } catch (updateError: any) {
        console.error('[HARVEST CRON LOG] Failed to update cron log with final status:', updateError)
        throw updateError
    }
}

/**
 * Updates the cron log with error status
 */
export async function updateHarvestInvoiceCronLogFailed(
    cronLogId: number,
    errorMessage: string
): Promise<void> {
    try {
        await prisma.harvestInvoiceCronLog.update({
            where: { id: cronLogId },
            data: {
                status: 'failed',
                completedAt: new Date(),
                errorMessage: errorMessage,
            }
        })
        console.log(`[HARVEST CRON LOG] Updated cron log ${cronLogId} with error status`)
    } catch (updateError: any) {
        console.error('[HARVEST CRON LOG] Failed to update cron log with error status:', updateError)
        throw updateError
    }
}

/**
 * Creates an error cron log entry when sync fails before creating initial log
 */
export async function createHarvestInvoiceErrorCronLog(
    errorMessage: string
): Promise<number | null> {
    try {
        console.log('[HARVEST CRON LOG] Creating error log entry for failed sync...')
        const errorLog = await prisma.harvestInvoiceCronLog.create({
            data: {
                status: 'failed',
                completedAt: new Date(),
                errorMessage: errorMessage,
                invoicesFound: 0,
                invoicesCreated: 0,
                invoicesUpdated: 0,
                invoicesFailed: 0,
                errors: [],
            }
        })
        console.log(`[HARVEST CRON LOG] Created error log entry with ID: ${errorLog.id}`)
        return errorLog.id
    } catch (createError: any) {
        console.error('[HARVEST CRON LOG] CRITICAL: Failed to create error log entry:', createError)
        return null
    }
}

