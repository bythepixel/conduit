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

    if (!validateMethod(req, res, ['GET', 'POST'])) return

    if (req.method === 'GET') {
        const mappings = await prisma.slackMapping.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                slackChannels: {
                    include: {
                        slackChannel: true
                    }
                },
                hubspotCompany: true
            }
        })
        return res.status(200).json(mappings)
    }

    if (req.method === 'POST') {
        const { channelIds, companyId, title, cadence } = req.body
        
        if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ error: 'At least one channelId is required' })
        }
        
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' })
        }

        try {
            // Find or create HubspotCompany
            let hubspotCompany = await prisma.hubspotCompany.findUnique({
                where: { companyId }
            })
            if (!hubspotCompany) {
                return res.status(400).json({ error: 'Company not found. Please create it first.' })
            }

            // Get SlackChannel IDs from channelIds (which are database IDs)
            const slackChannelIds = channelIds.map((id: number) => Number(id))
            const slackChannels = await prisma.slackChannel.findMany({
                where: { id: { in: slackChannelIds } }
            })

            if (slackChannels.length !== slackChannelIds.length) {
                return res.status(400).json({ error: 'One or more channels not found' })
            }

            // Validate cadence
            const cadenceValue = cadence && VALID_CADENCES.includes(cadence as any) ? cadence : DEFAULT_CADENCE

            // Create mapping with multiple channels
            const mapping = await prisma.slackMapping.create({
                data: {
                    title,
                    hubspotCompanyId: hubspotCompany.id,
                    cadence: cadenceValue as 'daily' | 'weekly' | 'monthly',
                    slackChannels: {
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
            return res.status(201).json(mapping)
        } catch (e: any) {
            return handleError(e, res)
        }
    }
}



