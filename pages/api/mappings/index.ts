import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        const mappings = await prisma.mapping.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return res.status(200).json(mappings)
    }

    if (req.method === 'POST') {
        const { slackChannelId, hubspotCompanyId, slackChannelName, hubspotCompanyName } = req.body
        if (!slackChannelId || !hubspotCompanyId) {
            return res.status(400).json({ error: 'Missing required fields' })
        }
        const mapping = await prisma.mapping.create({
            data: {
                slackChannelId,
                hubspotCompanyId,
                slackChannelName,
                hubspotCompanyName,
            },
        })
        return res.status(201).json(mapping)
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
}
