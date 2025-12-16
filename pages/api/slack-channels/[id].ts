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
            // Check if channel is used in any mappings
            const mappingCount = await prisma.mapping.count({
                where: { slackChannelId: Number(id) }
            })

            if (mappingCount > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete channel. It is used in ${mappingCount} mapping(s). Please remove the mappings first.` 
                })
            }

            await prisma.slackChannel.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            if (e.code === 'P2025') {
                return res.status(404).json({ error: "Channel not found" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    if (req.method === 'PUT') {
        const { channelId, name } = req.body

        if (!channelId) {
            return res.status(400).json({ error: "channelId is required" })
        }

        try {
            const channel = await prisma.slackChannel.update({
                where: { id: Number(id) },
                data: {
                    channelId,
                    name,
                },
            })
            return res.status(200).json(channel)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Channel ID already exists" })
            }
            if (e.code === 'P2025') {
                return res.status(404).json({ error: "Channel not found" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

