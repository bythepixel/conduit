import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'

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
            // Check if channel is used in any mappings (through pivot table)
            const mappingCount = await prisma.mappingSlackChannel.count({
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
            return handleError(e, res)
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
            return handleError(e, res)
        }
    }
}

