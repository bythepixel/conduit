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
            // Check if it's a Prisma client issue
            if (e.message?.includes('updateMany') || e.message?.includes('undefined')) {
                return res.status(500).json({ 
                    error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate' 
                })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

