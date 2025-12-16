import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.method === 'GET') {
        const mappings = await prisma.mapping.findMany({
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
            const validCadences = ['daily', 'weekly', 'monthly']
            const cadenceValue = cadence && validCadences.includes(cadence) ? cadence : 'daily'

            // Create mapping with multiple channels
            const mapping = await prisma.mapping.create({
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
            console.error('Error creating mapping:', e)
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
}
