import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const result = await prisma.hubspotCompany.updateMany({
            data: {
                btpAbbreviation: null
            }
        })

        return res.status(200).json({
            message: 'All abbreviations cleared successfully',
            count: result.count
        })
    } catch (error: any) {
        console.error('[Clear Abbreviations] Error:', error)
        handleError(error, res)
    }
}
