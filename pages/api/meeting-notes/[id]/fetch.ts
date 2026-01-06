import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../../lib/config/auth"
import { FirefliesService } from '../../../../lib/services/firefliesService'

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
        const meetingId = id as string

        if (!meetingId) {
            return res.status(400).json({ error: 'Meeting ID is required' })
        }

        const result = await FirefliesService.fetchAndSyncMeeting(meetingId)

        if (result.success) {
            const updatedNote = await prisma.meetingNote.findUnique({
                where: { meetingId: meetingId }
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
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        })
    }
}
