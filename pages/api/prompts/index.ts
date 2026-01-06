import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['GET', 'POST'])) return

    if (req.method === 'GET') {
        const prompts = await prisma.prompt.findMany({
            orderBy: [
                { isActive: 'desc' },
                { createdAt: 'desc' }
            ]
        })
        return res.status(200).json(prompts)
    }

    if (req.method === 'POST') {
        const { name, content, isActive } = req.body

        if (!name || !content) {
            return res.status(400).json({ error: "Name and content are required" })
        }

        try {
            // If setting as active, deactivate all other prompts first
            if (isActive) {
                await prisma.prompt.updateMany({
                    where: { isActive: true },
                    data: { isActive: false }
                })
            }

            const prompt = await prisma.prompt.create({
                data: {
                    name,
                    content,
                    isActive: isActive || false
                }
            })
            return res.status(201).json(prompt)
        } catch (e: any) {
            handleError(e, res)
        }
    }
}

