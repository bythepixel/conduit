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

    if (!validateMethod(req, res, ['DELETE', 'PUT'])) return

    const { id } = req.query

    if (req.method === 'DELETE') {
        try {
            // Check if company is used in any mappings
            const mappingCount = await prisma.slackMapping.count({
                where: { hubspotCompanyId: Number(id) }
            })

            if (mappingCount > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete company. It is used in ${mappingCount} mapping(s). Please remove the mappings first.` 
                })
            }

            await prisma.hubspotCompany.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            if (e.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
                return res.status(404).json({ error: "Company not found" })
            }
            handleError(e, res)
        }
    }

    if (req.method === 'PUT') {
        const { companyId, name, btpAbbreviation, activeClient } = req.body

        if (!companyId) {
            return res.status(400).json({ error: "companyId is required" })
        }

        try {
            const company = await prisma.hubspotCompany.update({
                where: { id: Number(id) },
                data: {
                    companyId,
                    name,
                    btpAbbreviation,
                    activeClient: activeClient !== undefined ? activeClient : undefined,
                },
            })
            return res.status(200).json(company)
        } catch (e: any) {
            if (e.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT) {
                // Check which unique constraint was violated
                if (e.meta?.target?.includes('btpAbbreviation')) {
                    return res.status(400).json({ error: "BTP Abbreviation already exists" })
                }
                return res.status(400).json({ error: "Company ID already exists" })
            }
            if (e.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
                return res.status(404).json({ error: "Company not found" })
            }
            handleError(e, res)
        }
    }
}

