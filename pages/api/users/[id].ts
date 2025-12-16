import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import bcrypt from 'bcryptjs'

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
        // Prevent deleting yourself (optional but good practice)
        // @ts-ignore
        if (Number(id) === Number(session.user.id)) {
            return res.status(400).json({ error: "Cannot delete your own account" })
        }

        await prisma.user.delete({
            where: { id: Number(id) },
        })
        return res.status(204).end()
    }

    if (req.method === 'PUT') {
        const { email, password, firstName, lastName, slackId, isAdmin } = req.body

        // Require at least email or slackId
        if (!email && !slackId) {
            // Check existing user to see if they have email or slackId
            const existing = await prisma.user.findUnique({
                where: { id: Number(id) },
                select: { email: true, slackId: true }
            })
            if (!existing?.email && !existing?.slackId) {
                return res.status(400).json({ error: "Email or Slack ID is required" })
            }
        }

        let data: any = { email: email || null, firstName, lastName, slackId: slackId || null, isAdmin: isAdmin || false }
        if (password) {
            data.password = await bcrypt.hash(password, 10)
        }

        try {
            const user = await prisma.user.update({
                where: { id: Number(id) },
                data,
            })
            // @ts-ignore
            const { password: _, ...result } = user
            return res.status(200).json(result)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Email or Slack ID already exists" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}
