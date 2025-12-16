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
            // Check if company is used in any mappings
            const mappingCount = await prisma.mapping.count({
                where: { hubspotCompanyId: Number(id) }
            })

            if (mappingCount > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete company. It is used in ${mappingCount} mapping(s). Please remove the mappings first.` 
                })
            }

            await prisma.hubspotCompany.delete({
                where: { id: Number(id) },
            })
            return res.status(204).end()
        } catch (e: any) {
            if (e.code === 'P2025') {
                return res.status(404).json({ error: "Company not found" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    if (req.method === 'PUT') {
        const { companyId, name } = req.body

        if (!companyId) {
            return res.status(400).json({ error: "companyId is required" })
        }

        try {
            const company = await prisma.hubspotCompany.update({
                where: { id: Number(id) },
                data: {
                    companyId,
                    name,
                },
            })
            return res.status(200).json(company)
        } catch (e: any) {
            if (e.code === 'P2002') {
                return res.status(400).json({ error: "Company ID already exists" })
            }
            if (e.code === 'P2025') {
                return res.status(404).json({ error: "Company not found" })
            }
            return res.status(500).json({ error: e.message })
        }
    }

    res.setHeader('Allow', ['DELETE', 'PUT'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}

