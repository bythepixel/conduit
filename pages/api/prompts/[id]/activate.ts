import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { handleError } from '../../../../lib/utils/errorHandler'
import { PRISMA_ERROR_CODES } from '../../../../lib/constants'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    const { id } = req.query

    try {
        // Check if prompt exists
        const prompt = await prisma.prompt.findUnique({
            where: { id: Number(id) }
        })

        if (!prompt) {
            return res.status(404).json({ error: "Prompt not found" })
        }

        // Deactivate all prompts
        await prisma.prompt.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        })

        // Activate the selected prompt
        const activatedPrompt = await prisma.prompt.update({
            where: { id: Number(id) },
            data: { isActive: true }
        })

        return res.status(200).json(activatedPrompt)
    } catch (e: any) {
        if (e.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
            return res.status(404).json({ error: "Prompt not found" })
        }
        handleError(e, res)
    }
}

