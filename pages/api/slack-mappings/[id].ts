import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { VALID_CADENCES, DEFAULT_CADENCE } from '../../../lib/constants'

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
            await prisma.slackMapping.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            return handleError(e, res)
        }
    }

    if (req.method === 'PUT') {
        const { channelIds, companyId, title, cadence } = req.body
        
        try {
            // Get existing mapping
            const existingMapping = await prisma.slackMapping.findUnique({
                where: { id: Number(id) },
                include: {
                    slackChannels: {
                        include: {
                            slackChannel: true
                        }
                    },
                    hubspotCompany: true
                }
            })

            if (!existingMapping) {
                return res.status(404).json({ error: 'Mapping not found' })
            }

            // Handle HubspotCompany update
            let hubspotCompanyId = existingMapping.hubspotCompanyId
            if (companyId) {
                const companyIdNum = Number(companyId)
                if (companyIdNum !== existingMapping.hubspotCompanyId) {
                    const hubspotCompany = await prisma.hubspotCompany.findUnique({
                        where: { id: companyIdNum }
                    })
                    if (!hubspotCompany) {
                        return res.status(400).json({ error: 'Company not found' })
                    }
                    hubspotCompanyId = hubspotCompany.id
                }
            }

            // Handle SlackChannels update
            const slackChannelIds = channelIds && Array.isArray(channelIds) 
                ? channelIds.map((id: number) => Number(id))
                : []

            // Validate cadence
            const cadenceValue = cadence && VALID_CADENCES.includes(cadence as any) ? cadence : DEFAULT_CADENCE

            // Update mapping with new channels
            const mapping = await prisma.slackMapping.update({
                where: { id: Number(id) },
                data: {
                    title,
                    hubspotCompanyId,
                    cadence: cadenceValue as 'daily' | 'weekly' | 'monthly',
                    slackChannels: {
                        deleteMany: {}, // Remove all existing channel relationships
                        create: slackChannelIds.map((channelId: number) => ({
                            slackChannelId: channelId
                        }))
                    }
                },
                include: {
                    slackChannels: {
                        include: {
                            slackChannel: true
                        }
                    },
                    hubspotCompany: true
                }
            })
            return res.status(200).json(mapping)
        } catch (e: any) {
            return handleError(e, res)
        }
    }
}


