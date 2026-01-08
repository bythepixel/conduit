import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['GET'])) return

    try {
        const { limit = '50', offset = '0' } = req.query
        
        const logs = await prisma.cronLog.findMany({
            take: parseInt(limit as string, 10),
            skip: parseInt(offset as string, 10),
            orderBy: { startedAt: 'desc' },
            include: {
                mappings: {
                    include: {
                        mapping: {
                            include: {
                                hubspotCompany: true,
                                slackChannels: {
                                    include: {
                                        slackChannel: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        const total = await prisma.cronLog.count()

        return res.status(200).json({
            logs,
            total,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10),
        })
    } catch (error: any) {
        console.error('Error fetching cron logs:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}








