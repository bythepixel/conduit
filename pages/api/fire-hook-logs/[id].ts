import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { prisma } from '../../../lib/prisma'
import { parseIdParam } from '../../../lib/utils/requestHelpers'
import { handleError } from '../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['DELETE'])) return

    const { id } = req.query
    const logId = parseIdParam(id, res, 'log ID')
    if (logId === null) return

    try {
        await prisma.fireHookLog.delete({
            where: { id: logId }
        })

        return res.status(200).json({
            success: true,
            message: 'Fire hook log deleted successfully'
        })
    } catch (error: any) {
        console.error('[Delete Fire Hook Log] Error in handler:', error)
        handleError(error, res)
    }
}
