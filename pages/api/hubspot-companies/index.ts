import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError, handlePrismaError } from '../../../lib/utils/errorHandler'
import { PRISMA_ERROR_CODES } from '../../../lib/constants'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
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
            if (e.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT) {
                // Check which unique constraint was violated
                if (e.meta?.target?.includes('btpAbbreviation')) {
                    return res.status(400).json({ error: "BTP Abbreviation already exists" })
                }
                return res.status(400).json({ error: "Company ID already exists" })
            }
            handleError(e, res)
        }
    }
}

