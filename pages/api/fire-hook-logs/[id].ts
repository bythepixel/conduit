import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { prisma } from '../../../lib/prisma'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['DELETE'])) return

    try {
        const { id } = req.query
        const logId = parseInt(id as string, 10)

        if (isNaN(logId)) {
            return res.status(400).json({
                error: 'Invalid log ID'
            })
        }

        await prisma.fireHookLog.delete({
            where: { id: logId }
        })

        return res.status(200).json({
            success: true,
            message: 'Fire hook log deleted successfully'
        })
    } catch (error: any) {
        console.error('[Delete Fire Hook Log] Error in handler:', error)

        if (error.code === 'P2025') {
            return res.status(404).json({
                error: 'Fire hook log not found'
            })
        }

        return res.status(500).json({
            error: 'Failed to delete fire hook log',
            details: error.message
        })
    }
}
