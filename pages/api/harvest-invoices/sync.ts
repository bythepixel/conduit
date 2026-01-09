import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import {
    createHarvestInvoiceCronLog,
    updateHarvestInvoiceCronLogInvoicesFound,
    finalizeHarvestInvoiceCronLog,
    updateHarvestInvoiceCronLogFailed,
    createHarvestInvoiceErrorCronLog
} from '../../../lib/services/harvest/harvestCronLogService'
import { createDealFromHarvestInvoice } from '../../../lib/services/hubspot/hubspotService'

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
        console.log('[CRON] Harvest invoices sync cron job triggered', {
            isVercelCron,
            hasAuth: !!req.headers.authorization,
            hasVercelHeader: !!req.headers['x-vercel-cron']
        })
    } else if (req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    // For cron jobs (GET), skip auth. For manual calls (POST), require auth
    if (req.method === 'POST') {
        const session = await requireAuth(req, res)
        if (!session) return
    }

    if (!validateMethod(req, res, ['GET', 'POST'])) return

    // Determine if this is a cron call (GET) or manual call (POST)
    const isCronCall = req.method === 'GET'
    let cronLogId: number | null = null

    try {
        // Create cron log entry if this is a cron call
        if (isCronCall) {
            cronLogId = await createHarvestInvoiceCronLog()
        }

        const harvestAccountId = process.env.HARVEST_ACCOUNT_ID
        const harvestAccessToken = process.env.HARVEST_ACCESS_TOKEN

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('[Harvest Sync] Environment check:', {
                hasAccountId: !!harvestAccountId,
                hasAccessToken: !!harvestAccessToken,
                accountIdLength: harvestAccountId?.length || 0,
                accessTokenLength: harvestAccessToken?.length || 0
            })
        }

        if (!harvestAccountId || !harvestAccessToken) {
            const errorMsg = 'Harvest API credentials not configured'
            if (isCronCall && cronLogId) {
                await updateHarvestInvoiceCronLogFailed(cronLogId, errorMsg)
            } else if (isCronCall) {
                await createHarvestInvoiceErrorCronLog(errorMsg)
            }
            return res.status(400).json({
                error: errorMsg,
                message: 'Please set HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN environment variables',
                debug: process.env.NODE_ENV === 'development' ? {
                    accountIdSet: !!harvestAccountId,
                    accessTokenSet: !!harvestAccessToken
                } : undefined
            })
        }

        const results = {
            created: 0,
            updated: 0,
            dealsCreated: 0,
            errors: [] as string[]
        }

        let page = 1
        let hasMore = true

        while (hasMore) {
            try {
                // Fetch invoices from Harvest API
                const response = await fetch(
                    `https://api.harvestapp.com/v2/invoices?page=${page}&per_page=100`,
                    {
                        headers: {
                            'Authorization': `Bearer ${harvestAccessToken}`,
                            'Harvest-Account-ID': harvestAccountId,
                            'Content-Type': 'application/json'
                        }
                    }
                )

                if (!response.ok) {
                    const errorText = await response.text()
                    const errorCode = response.status
                    const errorMsg = `Harvest API Error (${errorCode}): ${errorText}`
                    
                    if (errorCode === 429) {
                        if (isCronCall && cronLogId) {
                            await updateHarvestInvoiceCronLogFailed(cronLogId, 'Harvest API Rate Limit Error')
                        }
                        return res.status(429).json({ 
                            error: 'Harvest API Rate Limit Error. Please try again later.',
                            details: { code: errorCode, message: errorText }
                        })
                    }

                    if (page === 1) {
                        if (isCronCall && cronLogId) {
                            await updateHarvestInvoiceCronLogFailed(cronLogId, errorMsg)
                        }
                        return res.status(errorCode).json({ 
                            error: `Harvest API Error: ${errorText}`,
                            details: { code: errorCode }
                        })
                    } else {
                        results.errors.push(`Error fetching page ${page}: ${errorText}`)
                        hasMore = false
                        break
                    }
                }

                const data = await response.json()
                const invoices = data.invoices || []

                if (invoices.length === 0) {
                    hasMore = false
                    break
                }

                // Update cron log with invoices found (only count once)
                if (isCronCall && cronLogId && page === 1) {
                    try {
                        const totalInvoices = data.total_entries || invoices.length
                        await updateHarvestInvoiceCronLogInvoicesFound(cronLogId, totalInvoices)
                    } catch (updateError: any) {
                        console.error('[HARVEST CRON LOG] Failed to update invoices found:', updateError)
                    }
                }

                for (const invoice of invoices) {
                    try {
                        const harvestId = invoice.id?.toString()
                        if (!harvestId) {
                            results.errors.push('Skipped invoice: No invoice ID')
                            continue
                        }

                        // Parse dates
                        const issueDate = invoice.issue_date ? new Date(invoice.issue_date) : null
                        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
                        const paidDate = invoice.paid_date ? new Date(invoice.paid_date) : null

                        // Parse amounts (Harvest returns as strings)
                        const parseDecimal = (value: any): number | null => {
                            if (value === null || value === undefined) return null
                            const parsed = typeof value === 'string' ? parseFloat(value) : value
                            return isNaN(parsed) ? null : parsed
                        }

                        const invoiceData: any = {
                            harvestId,
                            clientId: invoice.client?.id?.toString() || undefined,
                            clientName: invoice.client?.name || undefined,
                            number: invoice.number || undefined,
                            purchaseOrder: invoice.purchase_order || undefined,
                            amount: parseDecimal(invoice.amount),
                            dueAmount: parseDecimal(invoice.due_amount),
                            tax: parseDecimal(invoice.tax),
                            taxAmount: parseDecimal(invoice.tax_amount),
                            discount: parseDecimal(invoice.discount),
                            discountAmount: parseDecimal(invoice.discount_amount),
                            subject: invoice.subject || undefined,
                            notes: invoice.notes || undefined,
                            currency: invoice.currency || undefined,
                            state: invoice.state || undefined,
                            issueDate: issueDate || undefined,
                            dueDate: dueDate || undefined,
                            paidDate: paidDate || undefined,
                            paymentTerm: invoice.payment_term || undefined,
                            metadata: invoice.metadata ? JSON.parse(JSON.stringify(invoice.metadata)) : undefined
                        }
                        
                        // Remove undefined values to avoid Prisma errors
                        Object.keys(invoiceData).forEach(key => {
                            if (invoiceData[key] === undefined) {
                                delete invoiceData[key]
                            }
                        })

                        // Try to find HarvestCompany if clientId exists
                        let harvestCompanyId: number | undefined = undefined
                        if (invoice.client?.id) {
                            const harvestCompany = await (prisma as any).harvestCompany.findUnique({
                                where: { harvestId: invoice.client.id.toString() }
                            })
                            if (harvestCompany) {
                                harvestCompanyId = harvestCompany.id
                            }
                        }

                        // Check if invoice exists
                        const existingInvoice = await prisma.harvestInvoice.findUnique({
                            where: { harvestId }
                        })

                        if (harvestCompanyId !== undefined) {
                            invoiceData.harvestCompanyId = harvestCompanyId
                        }

                        let invoiceId: number
                        let shouldCreateDeal = false
                        
                        if (existingInvoice) {
                            // Update existing invoice
                            // Only create deal if invoice doesn't already have one
                            shouldCreateDeal = !(existingInvoice as any).hubspotDealId
                            
                            await prisma.harvestInvoice.update({
                                where: { id: existingInvoice.id },
                                data: invoiceData
                            })
                            invoiceId = existingInvoice.id
                            results.updated++
                        } else {
                            // Create new invoice
                            const newInvoice = await prisma.harvestInvoice.create({
                                data: invoiceData
                            })
                            invoiceId = newInvoice.id
                            shouldCreateDeal = true // New invoice won't have a deal yet
                            results.created++
                        }

                        // Automatically create HubSpot deal if validation passes
                        // Only create if:
                        // 1. Invoice doesn't already have a deal (checked above)
                        // 2. Invoice is not in Draft state
                        // 3. There's a mapping (will be checked by createDealFromHarvestInvoice)
                        if (shouldCreateDeal && 
                            invoiceData.state && 
                            invoiceData.state.toLowerCase() !== 'draft') {
                            
                            // Try to create the deal
                            // This will fail gracefully if there's no mapping
                            try {
                                await createDealFromHarvestInvoice(invoiceId)
                                results.dealsCreated++
                                console.log(`[Harvest Sync] Automatically created HubSpot deal for invoice ${invoiceId}`)
                            } catch (dealError: any) {
                                // If it's a mapping error, that's expected - just log it
                                if (dealError.message && dealError.message.includes('mapped to any HubSpot company')) {
                                    // This is expected - no mapping exists, skip deal creation
                                    console.log(`[Harvest Sync] Skipping deal creation for invoice ${invoiceId}: No company mapping`)
                                } else {
                                    // Other errors (rate limits, etc.) - log but don't fail the sync
                                    console.error(`[Harvest Sync] Failed to create deal for invoice ${invoiceId}:`, dealError.message)
                                    // Don't add to errors array as this is a secondary operation
                                }
                            }
                        }
                    } catch (error: any) {
                        const errorMsg = error.code === 'P2002' 
                            ? 'Duplicate entry (harvestId already exists)'
                            : error.message || 'Unknown error'
                        results.errors.push(`Error processing invoice ${invoice.id}: ${errorMsg}`)
                        console.error(`Error processing Harvest invoice ${invoice.id}:`, error)
                    }
                }

                // Check if there are more pages
                const totalPages = data.total_pages || 1
                if (page >= totalPages) {
                    hasMore = false
                } else {
                    page++
                }

            } catch (fetchError: any) {
                console.error('[Harvest API] Error fetching invoices:', fetchError)
                const errorMsg = `Harvest API Error: ${fetchError.message || 'Unknown error'}`
                if (page === 1) {
                    if (isCronCall && cronLogId) {
                        await updateHarvestInvoiceCronLogFailed(cronLogId, errorMsg)
                    }
                    return res.status(500).json({ 
                        error: errorMsg,
                        details: { error: fetchError }
                    })
                } else {
                    results.errors.push(`Error fetching page ${page}: ${fetchError.message || 'Unknown error'}`)
                    hasMore = false
                }
            }
        }

        // Finalize cron log if this was a cron call
        if (isCronCall && cronLogId) {
            try {
                await finalizeHarvestInvoiceCronLog(cronLogId, results)
            } catch (finalizeError: any) {
                console.error('[HARVEST CRON LOG] Failed to finalize cron log:', finalizeError)
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing invoices from Harvest:', error)
        
        // Update cron log with error if this was a cron call
        if (isCronCall && cronLogId) {
            try {
                await updateHarvestInvoiceCronLogFailed(cronLogId, error.message || 'Unknown error')
            } catch (updateError: any) {
                console.error('[HARVEST CRON LOG] Failed to update cron log with error:', updateError)
            }
        } else if (isCronCall) {
            try {
                await createHarvestInvoiceErrorCronLog(error.message || 'Unknown error')
            } catch (createError: any) {
                console.error('[HARVEST CRON LOG] Failed to create error cron log:', createError)
            }
        }
        
        handleError(error, res)
    }
}

