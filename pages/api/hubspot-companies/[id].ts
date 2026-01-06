import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { parseIdParam } from '../../../lib/utils/requestHelpers'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['DELETE', 'PUT'])) return

    const { id } = req.query
    const companyId = parseIdParam(id, res, 'company ID')
    if (companyId === null) return

    if (req.method === 'DELETE') {
        try {
            // Check if company is used in any mappings
            const mappingCount = await prisma.slackMapping.count({
                where: { hubspotCompanyId: companyId }
            })

            if (mappingCount > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete company. It is used in ${mappingCount} mapping(s). Please remove the mappings first.` 
                })
            }

            await prisma.hubspotCompany.delete({
                where: { id: companyId },
            })
            return res.status(204).end()
        } catch (e: any) {
            handleError(e, res)
        }
    }

    if (req.method === 'PUT') {
        const { companyId: bodyCompanyId, name, btpAbbreviation, activeClient } = req.body

        if (!bodyCompanyId) {
            return res.status(400).json({ error: "companyId is required" })
        }

        try {
            const company = await prisma.hubspotCompany.update({
                where: { id: companyId },
                data: {
                    companyId: bodyCompanyId,
                    name,
                    btpAbbreviation,
                    activeClient: activeClient !== undefined ? activeClient : undefined,
                },
            })
            return res.status(200).json(company)
        } catch (e: any) {
            handleError(e, res)
        }
    }
}

