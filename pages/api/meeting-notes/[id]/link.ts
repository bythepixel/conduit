import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
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
    const { hubspotCompanyId } = req.body

    const meetingNoteId = parseIdParam(id, res, 'meeting note ID')
    if (meetingNoteId === null) return

    try {

        const updatedNote = await prisma.meetingNote.update({
            where: { id: meetingNoteId },
            data: {
                hubspotCompanyId: hubspotCompanyId || null
            },
            include: HUBSPOT_COMPANY_INCLUDE,
        })

        return res.status(200).json({
            message: 'Meeting note linked successfully',
            note: updatedNote
        })
    } catch (error: any) {
        console.error('[Link Meeting Note] Error:', error)
        handleError(error, res)
    }
}
