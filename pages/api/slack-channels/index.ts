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
        const channels = await prisma.slackChannel.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { mappings: true }
                }
            }
        })
        return res.status(200).json(channels)
    }

    if (req.method === 'POST') {
        const { channelId, name } = req.body
        if (!channelId) {
            return res.status(400).json({ error: 'channelId is required' })
        }
        try {
            const channel = await prisma.slackChannel.create({
                data: {
                    channelId,
                    name,
                },
            })
            return res.status(201).json(channel)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Channel ID already exists" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

