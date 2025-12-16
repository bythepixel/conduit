import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const { id } = req.query

    if (req.method === 'DELETE') {
        try {
            const prompt = await prisma.prompt.findUnique({
                where: { id: Number(id) }
            })

            if (!prompt) {
                return res.status(404).json({ error: "Prompt not found" })
            }

            // Prevent deleting the active prompt
            if (prompt.isActive) {
                return res.status(400).json({ error: "Cannot delete the active prompt. Please activate another prompt first." })
            }

            await prisma.prompt.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            return res.status(500).json({ error: e.message })
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
                        id: { not: Number(id) }
                    },
                    data: { isActive: false }
                })
            }

            const prompt = await prisma.prompt.update({
                where: { id: Number(id) },
                data: {
                    name,
                    content,
                    isActive: isActive || false
                },
            })
            return res.status(200).json(prompt)
        } catch (e: any) {
            // Check if it's a Prisma client issue
            if (e.message?.includes('updateMany') || e.message?.includes('undefined')) {
                return res.status(500).json({ 
                    error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate' 
                })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

