import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { syncMeetingNoteToHubSpot } from '../../../../lib/services/hubspotService'
import { HUBSPOT_COMPANY_INCLUDE } from '../../../../lib/constants/selects'
import { handleError } from '../../../../lib/utils/errorHandler'
import { parseIdParam } from '../../../../lib/utils/requestHelpers'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    const { id } = req.query
    const meetingNoteId = parseIdParam(id, res, 'meeting note ID')
    if (meetingNoteId === null) return

    try {

        // Sync the meeting note to HubSpot
        await syncMeetingNoteToHubSpot(meetingNoteId)

        // Fetch the updated note with company relationship
        const updatedNote = await prisma.meetingNote.findUnique({
            where: { id: meetingNoteId },
            include: HUBSPOT_COMPANY_INCLUDE,
        })

        return res.status(200).json({
            success: true,
            message: 'Meeting note synced to HubSpot successfully',
            note: updatedNote
        })
    } catch (error: any) {
        console.error('[Sync Meeting Note to HubSpot] Error:', error)
        handleError(error, res)
    }
}

