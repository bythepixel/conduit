import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { parseIdParam } from '../../../lib/utils/requestHelpers'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['DELETE', 'PUT'])) return

    const { id } = req.query
    const promptId = parseIdParam(id, res, 'prompt ID')
    if (promptId === null) return

    if (req.method === 'DELETE') {
        try {
            const prompt = await prisma.prompt.findUnique({
                where: { id: promptId }
            })

            if (!prompt) {
                return res.status(404).json({ error: "Prompt not found" })
            }

            // Prevent deleting the active prompt
            if (prompt.isActive) {
                return res.status(400).json({ error: "Cannot delete the active prompt. Please activate another prompt first." })
            }

            await prisma.prompt.delete({
                where: { id: promptId },
            })
            return res.status(204).end()
        } catch (e: any) {
            handleError(e, res)
        }
    }

    if (req.method === 'PUT') {
        const { name, content, isActive } = req.body

        if (!name || !content) {
            return res.status(400).json({ error: "Name and content are required" })
        }

        try {
            // If setting as active, deactivate all other prompts first
            if (isActive) {
                await prisma.prompt.updateMany({
                    where: { 
                        isActive: true,
                        id: { not: promptId }
                    },
                    data: { isActive: false }
                })
            }

            const prompt = await prisma.prompt.update({
                where: { id: promptId },
                data: {
                    name,
                    content,
                    isActive: isActive || false
                },
            })
            return res.status(200).json(prompt)
        } catch (e: any) {
            handleError(e, res)
        }
    }
}

