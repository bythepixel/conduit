import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { hashPassword } from '../../../lib/utils/password'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['DELETE', 'PUT'])) return

    const { id } = req.query

    if (req.method === 'DELETE') {
        // Prevent deleting yourself
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
            data.password = await hashPassword(password)
        }

        try {
            const user = await prisma.user.update({
                where: { id: Number(id) },
                data,
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
            return res.status(200).json(user)
        } catch (e: any) {
            return handleError(e, res)
        }
    }
}
