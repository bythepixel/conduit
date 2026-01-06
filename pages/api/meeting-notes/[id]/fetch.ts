import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { FirefliesService } from '../../../../lib/services/firefliesService'
import { HUBSPOT_COMPANY_INCLUDE } from '../../../../lib/constants/selects'
import { handleError } from '../../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const { id } = req.query
        const meetingId = id as string

        if (!meetingId) {
            return res.status(400).json({ error: 'Meeting ID is required' })
        }

        const result = await FirefliesService.fetchAndSyncMeeting(meetingId)

        if (result.success) {
            const updatedNote = await prisma.meetingNote.findUnique({
                where: { meetingId: meetingId },
                include: HUBSPOT_COMPANY_INCLUDE,
            })
            return res.status(200).json({
                success: true,
                message: 'Meeting notes fetched successfully',
                note: updatedNote
            })
        } else {
            return res.status(500).json({
                error: result.error || 'Failed to fetch meeting notes'
            })
        }
    } catch (error: any) {
        console.error('[Fetch Meeting Note] Error:', error)
        handleError(error, res)
    }
}
