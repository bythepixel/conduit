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

    if (!validateMethod(req, res, ['GET', 'POST', 'DELETE'])) return

    if (req.method === 'GET') {
        try {
            const mappings = await prisma.harvestCompanyMapping.findMany({
                include: {
                    hubspotCompany: true,
                    harvestCompany: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
            return res.status(200).json(mappings)
        } catch (error: any) {
            handleError(error, res)
        }
    }

    if (req.method === 'POST') {
        try {
            const { hubspotCompanyId, harvestCompanyId } = req.body

            if (!hubspotCompanyId || !harvestCompanyId) {
                return res.status(400).json({ error: 'hubspotCompanyId and harvestCompanyId are required' })
            }

            // Check if mapping already exists
            const existingMapping = await prisma.harvestCompanyMapping.findUnique({
                where: {
                    hubspotCompanyId_harvestCompanyId: {
                        hubspotCompanyId: parseInt(hubspotCompanyId),
                        harvestCompanyId: parseInt(harvestCompanyId)
                    }
                }
            })

            if (existingMapping) {
                return res.status(400).json({ error: 'Mapping already exists' })
            }

            // Verify companies exist
            const hubspotCompany = await prisma.hubspotCompany.findUnique({
                where: { id: parseInt(hubspotCompanyId) }
            })

            const harvestCompany = await prisma.harvestCompany.findUnique({
                where: { id: parseInt(harvestCompanyId) }
            })

            if (!hubspotCompany) {
                return res.status(404).json({ error: 'HubSpot company not found' })
            }

            if (!harvestCompany) {
                return res.status(404).json({ error: 'Harvest company not found' })
            }

            const mapping = await prisma.harvestCompanyMapping.create({
                data: {
                    hubspotCompanyId: parseInt(hubspotCompanyId),
                    harvestCompanyId: parseInt(harvestCompanyId)
                },
                include: {
                    hubspotCompany: true,
                    harvestCompany: true
                }
            })

            return res.status(201).json(mapping)
        } catch (error: any) {
            handleError(error, res)
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { hubspotCompanyId, harvestCompanyId } = req.query

            if (!hubspotCompanyId || !harvestCompanyId) {
                return res.status(400).json({ error: 'hubspotCompanyId and harvestCompanyId are required' })
            }

            await prisma.harvestCompanyMapping.delete({
                where: {
                    hubspotCompanyId_harvestCompanyId: {
                        hubspotCompanyId: parseInt(hubspotCompanyId as string),
                        harvestCompanyId: parseInt(harvestCompanyId as string)
                    }
                }
            })

            return res.status(200).json({ message: 'Mapping deleted successfully' })
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Mapping not found' })
            }
            handleError(error, res)
        }
    }
}

