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
        const companies = await prisma.hubspotCompany.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { mappings: true }
                }
            }
        })
        return res.status(200).json(companies)
    }

    if (req.method === 'POST') {
        const { companyId, name } = req.body
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' })
        }
        try {
            const company = await prisma.hubspotCompany.create({
                data: {
                    companyId,
                    name,
                },
            })
            return res.status(201).json(company)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Company ID already exists" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

