import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { id } = req.query

    if (req.method === 'DELETE') {
        await prisma.mapping.delete({
            where: { id: Number(id) },
        })
        return res.status(204).end()
    }

    if (req.method === 'PUT') {
        const { slackChannelId, hubspotCompanyId, slackChannelName, hubspotCompanyName } = req.body
        const mapping = await prisma.mapping.update({
            where: { id: Number(id) },
            data: {
                slackChannelId,
                hubspotCompanyId,
                slackChannelName,
                hubspotCompanyName,
            },
        })
        return res.status(200).json(mapping)
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
}
