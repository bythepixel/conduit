import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../../lib/config/auth"
import { syncMeetingNoteToHubSpot } from '../../../../lib/services/hubspotService'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    try {
        const { id } = req.query
        const meetingNoteId = parseInt(id as string, 10)

        if (isNaN(meetingNoteId)) {
            return res.status(400).json({ error: 'Invalid meeting note ID' })
        }

        // Sync the meeting note to HubSpot
        await syncMeetingNoteToHubSpot(meetingNoteId)

        // Fetch the updated note with company relationship
        const updatedNote = await prisma.meetingNote.findUnique({
            where: { id: meetingNoteId },
            include: {
                hubspotCompany: {
                    select: {
                        id: true,
                        name: true,
                        btpAbbreviation: true
                    }
                }
            }
        })

        return res.status(200).json({
            success: true,
            message: 'Meeting note synced to HubSpot successfully',
            note: updatedNote
        })
    } catch (error: any) {
        console.error('[Sync Meeting Note to HubSpot] Error:', error)
        return res.status(500).json({
            error: 'Failed to sync meeting note to HubSpot',
            details: error.message
        })
    }
}

