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

    if (!validateMethod(req, res, ['GET', 'POST'])) return

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
        const { channelId, name, isClient } = req.body
        if (!channelId) {
            return res.status(400).json({ error: 'channelId is required' })
        }
        try {
            const channel = await prisma.slackChannel.create({
                data: {
                    channelId,
                    name,
                    isClient: isClient !== undefined ? isClient : false,
                },
            })
            return res.status(201).json(channel)
        } catch (e: any) {
            if (e.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT) {
                return res.status(400).json({ error: "Channel ID already exists" })
            }
            handleError(e, res)
        }
    }
}

