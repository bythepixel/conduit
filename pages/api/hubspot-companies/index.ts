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

    if (req.method === 'GET') {
        const companies = await prisma.hubspotCompany.findMany({
            orderBy: [
                { name: 'asc' },
                { companyId: 'asc' } // Secondary sort by companyId for companies without names
            ],
            include: {
                _count: {
                    select: { mappings: true }
                }
            }
        })
        return res.status(200).json(companies)
    }

    if (req.method === 'POST') {
        const { companyId, name, btpAbbreviation, activeClient } = req.body
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' })
        }
        try {
            const company = await prisma.hubspotCompany.create({
                data: {
                    companyId,
                    name,
                    btpAbbreviation,
                    activeClient: activeClient || false,
                },
            })
            return res.status(201).json(company)
        } catch (e: any) {
            if (e.code === 'P2002') {
                // Check which unique constraint was violated
                if (e.meta?.target?.includes('btpAbbreviation')) {
                    return res.status(400).json({ error: "BTP Abbreviation already exists" })
                }
                return res.status(400).json({ error: "Company ID already exists" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

