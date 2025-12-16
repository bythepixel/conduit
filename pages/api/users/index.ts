import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import bcrypt from "bcryptjs"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.method === 'GET') {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, firstName: true, lastName: true, slackId: true, isAdmin: true, createdAt: true }
        })
        return res.status(200).json(users)
    }

    if (req.method === 'POST') {
        const { email, password, firstName, lastName, slackId, isAdmin } = req.body
        
        // Require at least email or slackId
        if (!email && !slackId) {
            return res.status(400).json({ error: "Email or Slack ID is required" })
        }
        
        const hashedPassword = await bcrypt.hash(password, 10)
        try {
            const user = await prisma.user.create({
                data: {
                    email: email || null,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    slackId: slackId || null,
                    isAdmin: isAdmin || false
                }
            })
            // @ts-ignore
            const { password: _, ...result } = user
            return res.status(201).json(result)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Email or Slack ID already exists" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}
