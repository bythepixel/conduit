import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../../lib/config/auth"

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

    const { id } = req.query
    const { hubspotCompanyId } = req.body

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid meeting note ID' })
    }

    try {
        const meetingNoteId = parseInt(id)
        if (isNaN(meetingNoteId)) {
            return res.status(400).json({ error: 'Invalid meeting note ID format' })
        }

        const updatedNote = await prisma.meetingNote.update({
            where: { id: meetingNoteId },
            data: {
                hubspotCompanyId: hubspotCompanyId || null
            },
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
            message: 'Meeting note linked successfully',
            note: updatedNote
        })
    } catch (error: any) {
        console.error('[Link Meeting Note] Error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        })
    }
}
