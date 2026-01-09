import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { handleError } from '../../../../lib/utils/errorHandler'
import { syncDealFromHarvestInvoice } from '../../../../lib/services/hubspot/hubspotService'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const { id } = req.query

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Invoice ID is required' })
        }

        const invoiceId = parseInt(id, 10)
        if (isNaN(invoiceId)) {
            return res.status(400).json({ error: 'Invalid invoice ID' })
        }

        const result = await syncDealFromHarvestInvoice(invoiceId)

        return res.status(200).json({
            message: 'Deal synced successfully',
            dealId: result.dealId,
            companyId: result.companyId,
            dealUrl: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || 'YOUR_PORTAL_ID'}/deal/${result.dealId}`
        })
    } catch (error: any) {
        console.error('Error syncing deal from invoice:', error)
        handleError(error, res)
    }
}

