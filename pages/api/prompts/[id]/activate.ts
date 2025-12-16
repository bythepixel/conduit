import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]"

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
        // Check if it's a Prisma client issue
        if (e.message?.includes('updateMany') || e.message?.includes('undefined')) {
            return res.status(500).json({ 
                error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate' 
            })
        }
        return res.status(500).json({ error: e.message })
    }
}

