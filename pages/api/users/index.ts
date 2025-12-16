import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { hashPassword } from '../../../lib/utils/password'
import { ERROR_MESSAGES } from '../../../lib/constants'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['GET', 'POST'])) return

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
        
        const hashedPassword = await hashPassword(password)
        try {
            const user = await prisma.user.create({
                data: {
                    email: email || null,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    slackId: slackId || null,
                    isAdmin: isAdmin || false
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    slackId: true,
                    isAdmin: true,
                    createdAt: true,
                    updatedAt: true
                }
            })
            return res.status(201).json(user)
        } catch (e: any) {
            return handleError(e, res)
        }
    }
}
