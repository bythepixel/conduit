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

    const { id } = req.query

    if (req.method === 'DELETE') {
        try {
            await prisma.mapping.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            return res.status(500).json({ error: e.message })
        }
    }

    if (req.method === 'PUT') {
        const { channelIds, companyId, title, cadence } = req.body
        
        try {
            // Get existing mapping
            const existingMapping = await prisma.mapping.findUnique({
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
            const validCadences = ['daily', 'weekly', 'monthly']
            const cadenceValue = cadence && validCadences.includes(cadence) ? cadence : 'daily'

            // Update mapping with new channels
            const mapping = await prisma.mapping.update({
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
            console.error('Error updating mapping:', e)
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
}
