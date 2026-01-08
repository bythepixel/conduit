import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { defaultRateLimiter } from '../../../lib/middleware/rateLimit'
import { corsMiddleware } from '../../../lib/middleware/cors'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle CORS
    if (corsMiddleware(req, res)) {
        return // CORS handled (OPTIONS request or origin blocked)
    }

    // Apply rate limiting
    const rateLimitResult = await defaultRateLimiter(req, res)
    if (rateLimitResult && !rateLimitResult.success) {
        return // Rate limit exceeded, response already sent
    }

    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['GET'])) return

    try {
        const invoices = await prisma.harvestInvoice.findMany({
            orderBy: [
                { issueDate: 'desc' },
                { createdAt: 'desc' }
            ]
        })
        return res.status(200).json(invoices)
    } catch (error: any) {
        handleError(error, res)
    }
}

