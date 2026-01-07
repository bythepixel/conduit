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

    if (!validateMethod(req, res, ['GET', 'POST'])) return

    if (req.method === 'GET') {
        const companies = await prisma.hubspotCompany.findMany({
            orderBy: [
                { name: 'asc' },
                { companyId: 'asc' } // Secondary sort by companyId for companies without names
            ],
            include: {
                _count: {
                    select: { mappings: true }
                }
            }
        })
        return res.status(200).json(companies)
    }

    if (req.method === 'POST') {
        const { companyId, name, btpAbbreviation, activeClient } = req.body
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' })
        }
        try {
            const company = await prisma.hubspotCompany.create({
                data: {
                    companyId,
                    name,
                    btpAbbreviation,
                    activeClient: activeClient || false,
                },
            })
            return res.status(201).json(company)
        } catch (e: any) {
            handleError(e, res)
        }
    }
}

