import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
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
    const promptId = parseIdParam(id, res, 'prompt ID')
    if (promptId === null) return

    try {
        // Check if prompt exists
        const prompt = await prisma.prompt.findUnique({
            where: { id: promptId }
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
            where: { id: promptId },
            data: { isActive: true }
        })

        return res.status(200).json(activatedPrompt)
    } catch (e: any) {
        handleError(e, res)
    }
}

