import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { syncDealFromHarvestInvoice } from '../../../lib/services/hubspot/hubspotService'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const skipPaidAndDealPaid = (req.body?.skipPaidAndDealPaid ?? true) !== false

        const invoices = await prisma.harvestInvoice.findMany({
            where: {
                hubspotDealId: { not: null },
                // Don't attempt to sync deals for draft invoices.
                NOT: { state: 'draft' },
            },
            select: {
                id: true,
                state: true,
                hubspotDealId: true,
                dealPaidSynced: true as any,
            } as any,
        })

        const results = {
            totalWithDeals: invoices.length,
            synced: 0,
            skippedDraft: 0,
            skippedPaidAndDealPaid: 0,
            failed: 0,
            errors: [] as string[],
        }

        for (const invoice of invoices) {
            try {
                const stateLower = (invoice.state || '').toString().toLowerCase()
                if (stateLower === 'draft') {
                    results.skippedDraft++
                    continue
                }

                // Optimization: once both the invoice and deal are paid-synced, skip.
                if (skipPaidAndDealPaid && stateLower === 'paid' && (invoice as any).dealPaidSynced === true) {
                    results.skippedPaidAndDealPaid++
                    continue
                }

                await syncDealFromHarvestInvoice(invoice.id)
                results.synced++

                // Light throttle to reduce risk of HubSpot rate limits in bulk runs.
                await sleep(200)
            } catch (e: any) {
                results.failed++
                results.errors.push(`Invoice ${invoice.id}: ${e?.message || 'Unknown error'}`)
            }
        }

        return res.status(200).json({ message: 'Deal sync completed', results })
    } catch (error: any) {
        handleError(error, res)
    }
}

