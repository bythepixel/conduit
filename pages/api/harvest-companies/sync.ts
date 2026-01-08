import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const harvestAccountId = process.env.HARVEST_ACCOUNT_ID
        const harvestAccessToken = process.env.HARVEST_ACCESS_TOKEN

        if (!harvestAccountId || !harvestAccessToken) {
            return res.status(400).json({
                error: 'Harvest API credentials not configured',
                message: 'Please set HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN environment variables'
            })
        }

        const results = {
            created: 0,
            updated: 0,
            errors: [] as string[]
        }

        // Fetch all clients from Harvest API
        let page = 1
        let hasMore = true
        const seenClientIds = new Set<string>()

        while (hasMore) {
            try {
                const response = await fetch(
                    `https://api.harvestapp.com/v2/clients?page=${page}&per_page=100`,
                    {
                        headers: {
                            'Authorization': `Bearer ${harvestAccessToken}`,
                            'Harvest-Account-ID': harvestAccountId,
                            'Content-Type': 'application/json'
                        }
                    }
                )

                if (!response.ok) {
                    const errorText = await response.text()
                    const errorCode = response.status
                    
                    if (errorCode === 429) {
                        return res.status(429).json({ 
                            error: 'Harvest API Rate Limit Error. Please try again later.',
                            details: { code: errorCode, message: errorText }
                        })
                    }

                    if (page === 1) {
                        return res.status(errorCode).json({ 
                            error: `Harvest API Error: ${errorText}`,
                            details: { code: errorCode }
                        })
                    } else {
                        results.errors.push(`Error fetching page ${page}: ${errorText}`)
                        hasMore = false
                        break
                    }
                }

                const data = await response.json()
                const clients = data.clients || []

                if (clients.length === 0) {
                    hasMore = false
                    break
                }

                for (const client of clients) {
                    try {
                        const harvestId = client.id?.toString()
                        if (!harvestId) {
                            results.errors.push('Skipped client: No client ID')
                            continue
                        }

                        if (seenClientIds.has(harvestId)) {
                            continue // Skip duplicates
                        }
                        seenClientIds.add(harvestId)

                        const companyData: any = {
                            harvestId,
                            name: client.name || undefined,
                            isActive: client.is_active !== false // Default to true unless explicitly false
                        }

                        // Remove undefined values
                        Object.keys(companyData).forEach(key => {
                            if (companyData[key] === undefined) {
                                delete companyData[key]
                            }
                        })

                        // Check if company exists
                        const existingCompany = await prisma.harvestCompany.findUnique({
                            where: { harvestId }
                        })

                        if (existingCompany) {
                            // Update existing company
                            await prisma.harvestCompany.update({
                                where: { id: existingCompany.id },
                                data: companyData
                            })
                            results.updated++
                        } else {
                            // Create new company
                            await prisma.harvestCompany.create({
                                data: companyData
                            })
                            results.created++
                        }
                    } catch (error: any) {
                        const errorMsg = error.code === 'P2002' 
                            ? 'Duplicate entry (harvestId already exists)'
                            : error.message || 'Unknown error'
                        results.errors.push(`Error processing client ${client.id}: ${errorMsg}`)
                        console.error(`Error processing Harvest client ${client.id}:`, error)
                    }
                }

                // Check if there are more pages
                const totalPages = data.total_pages || 1
                if (page >= totalPages) {
                    hasMore = false
                } else {
                    page++
                }

            } catch (fetchError: any) {
                console.error('[Harvest API] Error fetching clients:', fetchError)
                if (page === 1) {
                    return res.status(500).json({ 
                        error: `Harvest API Error: ${fetchError.message || 'Unknown error'}`,
                        details: { error: fetchError }
                    })
                } else {
                    results.errors.push(`Error fetching page ${page}: ${fetchError.message || 'Unknown error'}`)
                    hasMore = false
                }
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing Harvest companies:', error)
        handleError(error, res)
    }
}

