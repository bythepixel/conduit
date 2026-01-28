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
        const { limit = '100', offset = '0', search = '' } = req.query
        const take = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500)
        const skip = Math.max(parseInt(offset as string, 10) || 0, 0)
        const searchTerm = (search as string).trim()

        const whereClause: any = searchTerm
            ? {
                OR: [
                    { harvestId: { contains: searchTerm, mode: 'insensitive' } },
                    { number: { contains: searchTerm, mode: 'insensitive' } },
                    { clientId: { contains: searchTerm, mode: 'insensitive' } },
                    { clientName: { contains: searchTerm, mode: 'insensitive' } },
                    { subject: { contains: searchTerm, mode: 'insensitive' } },
                    { purchaseOrder: { contains: searchTerm, mode: 'insensitive' } },
                    { hubspotDealId: { contains: searchTerm, mode: 'insensitive' } },
                ]
            }
            : undefined

        const invoices = await prisma.harvestInvoice.findMany({
            where: whereClause,
            take,
            skip,
            include: {
                harvestCompany: {
                    include: {
                        mappings: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { issueDate: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        const total = await prisma.harvestInvoice.count({
            where: whereClause
        })

        // Get all unique clientIds that don't have harvestCompany loaded
        const clientIdsToCheck = invoices
            .filter(inv => !inv.harvestCompany && inv.clientId)
            .map(inv => inv.clientId!)
            .filter((id, index, self) => self.indexOf(id) === index) // unique

        // Fetch HarvestCompanies for invoices that only have clientId
        const harvestCompaniesMap = new Map<string, { mappings: { id: number }[] }>()
        if (clientIdsToCheck.length > 0) {
            const harvestCompanies = await prisma.harvestCompany.findMany({
                where: {
                    harvestId: {
                        in: clientIdsToCheck
                    }
                },
                include: {
                    mappings: {
                        select: {
                            id: true
                        }
                    }
                }
            })
            
            harvestCompanies.forEach(hc => {
                harvestCompaniesMap.set(hc.harvestId, { mappings: hc.mappings })
            })
        }

        // Map invoices to include hasMapping flag
        const invoicesWithMapping = invoices.map(invoice => {
            // Determine if there's a mapping
            let hasMapping = false
            
            if (invoice.harvestCompany) {
                // Invoice has a direct link to HarvestCompany
                hasMapping = invoice.harvestCompany.mappings && invoice.harvestCompany.mappings.length > 0
            } else if (invoice.clientId) {
                // Invoice has clientId but no harvestCompany relation, check the map
                const harvestCompany = harvestCompaniesMap.get(invoice.clientId)
                hasMapping = harvestCompany ? (harvestCompany.mappings && harvestCompany.mappings.length > 0) : false
            }

            // Remove the nested relations from the response and add hasMapping flag
            const { harvestCompany, ...invoiceData } = invoice as any
            return {
                ...invoiceData,
                hasMapping
            }
        })

        return res.status(200).json({
            invoices: invoicesWithMapping,
            total,
            limit: take,
            offset: skip
        })
    } catch (error: any) {
        handleError(error, res)
    }
}

