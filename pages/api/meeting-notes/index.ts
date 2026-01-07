import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { HUBSPOT_COMPANY_INCLUDE } from '../../../lib/constants/selects'
import { lenientRateLimiter } from '../../../lib/middleware/rateLimit'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Apply rate limiting (lenient for read-only endpoint)
    const rateLimitResult = await lenientRateLimiter(req, res)
    if (rateLimitResult && !rateLimitResult.success) {
        return // Rate limit exceeded, response already sent
    }

    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['GET'])) return

    const notes = await prisma.meetingNote.findMany({
        orderBy: { meetingDate: 'desc' },
        include: HUBSPOT_COMPANY_INCLUDE,
    })
    return res.status(200).json(notes)
}



