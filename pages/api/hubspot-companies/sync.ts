import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { Client as HubSpotClient } from '@hubspot/api-client'
import { getRequiredEnv } from '../../../lib/config/env'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const token = getRequiredEnv('HUBSPOT_ACCESS_TOKEN')
        const hubspot = new HubSpotClient({ accessToken: token })

        // Fetch all HubSpot companies with pagination
        const results = {
            created: 0,
            updated: 0,
            deleted: 0,
            errors: [] as string[]
        }

        // Track all company IDs from HubSpot to identify which ones to delete
        const hubspotCompanyIds = new Set<string>()

        let after: string | undefined = undefined
        let hasMore = true

        while (hasMore) {
            try {
                const response: any = await hubspot.crm.companies.basicApi.getPage(
                    100, // limit
                    after,
                    ['name'] // properties to fetch
                )

                const companies = response.results || []
                
                for (const company of companies) {
                    try {
                        const companyId = company.id
                        const name = company.properties?.name || null

                        if (!companyId) {
                            results.errors.push(`Skipped company: No company ID`)
                            continue
                        }

                        const companyIdStr = companyId.toString()
                        hubspotCompanyIds.add(companyIdStr)

                        // Check if company exists by companyId
                        const existingCompany = await prisma.hubspotCompany.findUnique({
                            where: { companyId: companyId.toString() }
                        })

                        if (existingCompany) {
                            // Update existing company - only update name if it's different
                            const updateData: any = {}
                            
                            if (name && name !== existingCompany.name) {
                                updateData.name = name
                            }
                            
                            // Only update if there are changes
                            if (Object.keys(updateData).length > 0) {
                                await prisma.hubspotCompany.update({
                                    where: { id: existingCompany.id },
                                    data: updateData
                                })
                                results.updated++
                            }
                        } else {
                            // Create new company
                            try {
                                await prisma.hubspotCompany.create({
                                    data: {
                                        companyId: companyIdStr,
                                        name: name || null
                                    }
                                })
                                results.created++
                            } catch (createError: any) {
                                if (createError.code === 'P2002') {
                                    results.errors.push(`Skipped ${name || companyId}: Duplicate entry (companyId already exists)`)
                                } else {
                                    throw createError
                                }
                            }
                        }
                    } catch (error: any) {
                        const errorMsg = error.code === 'P2002' 
                            ? `Duplicate entry (companyId already exists)`
                            : error.message || 'Unknown error'
                        results.errors.push(`Error processing ${company.properties?.name || company.id}: ${errorMsg}`)
                        console.error(`Error processing HubSpot company ${company.id}:`, error)
                    }
                }

                // Check if there are more pages
                after = response.paging?.next?.after
                hasMore = !!after

            } catch (hubspotError: any) {
                const errorCode = hubspotError.code || hubspotError.statusCode || hubspotError.status
                const errorMsg = hubspotError.message || hubspotError.body?.message || 'Unknown error'
                
                console.error('[HubSpot API] Error fetching companies:', {
                    code: errorCode,
                    message: errorMsg,
                    error: hubspotError
                })

                if (errorCode === 429 || 
                    errorMsg.toLowerCase().includes('rate limit') || 
                    errorMsg.toLowerCase().includes('too many requests')) {
                    return res.status(429).json({ 
                        error: `HubSpot API Rate Limit Error: ${errorMsg}. Please try again later.`,
                        details: {
                            code: errorCode,
                            message: errorMsg
                        }
                    })
                }

                // If it's the first page, return error. Otherwise, log and continue with what we have
                if (!after) {
                    return res.status(500).json({ 
                        error: `HubSpot API Error: ${errorMsg}`,
                        details: {
                            code: errorCode,
                            message: errorMsg
                        }
                    })
                } else {
                    // Log error but continue with partial results
                    results.errors.push(`Error fetching additional pages: ${errorMsg}`)
                    hasMore = false
                }
            }
        }

        // Delete companies that are not present in HubSpot
        try {
            const companiesToDelete = await prisma.hubspotCompany.findMany({
                where: {
                    companyId: {
                        notIn: Array.from(hubspotCompanyIds)
                    }
                }
            })

            // Check if any companies to delete are used in mappings
            for (const company of companiesToDelete) {
                const mappingCount = await prisma.slackMapping.count({
                    where: { hubspotCompanyId: company.id }
                })

                if (mappingCount > 0) {
                    results.errors.push(`Cannot delete ${company.name || company.companyId}: Used in ${mappingCount} mapping(s)`)
                } else {
                    await prisma.hubspotCompany.delete({
                        where: { id: company.id }
                    })
                    results.deleted++
                }
            }
        } catch (deleteError: any) {
            console.error('Error deleting companies not in HubSpot:', deleteError)
            results.errors.push(`Error deleting companies: ${deleteError.message || 'Unknown error'}`)
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing companies from HubSpot:', error)
        handleError(error, res)
    }
}

