import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../lib/config/auth"

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

    try {
        const result = await prisma.hubspotCompany.updateMany({
            data: {
                btpAbbreviation: null
            }
        })

        return res.status(200).json({
            message: 'All abbreviations cleared successfully',
            count: result.count
        })
    } catch (error: any) {
        console.error('[Clear Abbreviations] Error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        })
    }
}
