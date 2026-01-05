import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { FirefliesService } from '../../../../lib/services/firefliesService'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const { id } = req.query
        const logId = parseInt(id as string, 10)

        if (isNaN(logId)) {
            return res.status(400).json({
                error: 'Invalid log ID'
            })
        }

        const result = await FirefliesService.processFireHookLog(logId)

        if (!result.success) {
            return res.status(result.error?.includes('not found') ? 404 : 400).json({
                error: result.error
            })
        }

        return res.status(200).json({
            success: true,
            meetingNoteId: result.meetingNoteId
        })
    } catch (error: any) {
        console.error('[Process Fire Hook Log] Error in handler:', error)
        return res.status(500).json({
            error: 'Failed to process fire hook log',
            details: error.message
        })
    }
}

