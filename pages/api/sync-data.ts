import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { handleError } from '../../lib/utils/errorHandler'
import { Client as HubSpotClient } from '@hubspot/api-client'
import { WebClient } from '@slack/web-api'
import { getRequiredEnv } from '../../lib/config/env'

// Force dynamic execution to prevent caching issues with Vercel cron jobs
export const dynamic = 'force-dynamic'

/**
 * Syncs HubSpot Companies from HubSpot API
 */
async function syncHubSpotCompanies(): Promise<{
    created: number
    updated: number
    deleted: number
    errors: string[]
}> {
    const token = getRequiredEnv('HUBSPOT_ACCESS_TOKEN')
    const hubspot = new HubSpotClient({ accessToken: token })

    const results = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [] as string[]
    }

    const hubspotCompanyIds = new Set<string>()
    let after: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
        try {
            const response: any = await hubspot.crm.companies.basicApi.getPage(
                100,
                after,
                ['name']
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

                    const existingCompany = await prisma.hubspotCompany.findUnique({
                        where: { companyId: companyIdStr }
                    })

                    if (existingCompany) {
                        const updateData: any = {}
                        if (name && name !== existingCompany.name) {
                            updateData.name = name
                        }
                        if (Object.keys(updateData).length > 0) {
                            await prisma.hubspotCompany.update({
                                where: { id: existingCompany.id },
                                data: updateData
                            })
                            results.updated++
                        }
                    } else {
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
                                results.errors.push(`Skipped ${name || companyId}: Duplicate entry`)
                            } else {
                                throw createError
                            }
                        }
                    }
                } catch (error: any) {
                    const errorMsg = error.code === 'P2002' 
                        ? `Duplicate entry`
                        : error.message || 'Unknown error'
                    results.errors.push(`Error processing ${company.properties?.name || company.id}: ${errorMsg}`)
                    console.error(`Error processing HubSpot company ${company.id}:`, error)
                }
            }

            after = response.paging?.next?.after
            hasMore = !!after

        } catch (hubspotError: any) {
            const errorCode = hubspotError.code || hubspotError.statusCode || hubspotError.status
            const errorMsg = hubspotError.message || hubspotError.body?.message || 'Unknown error'
            
            console.error('[HubSpot API] Error fetching companies:', {
                code: errorCode,
                message: errorMsg
            })

            if (errorCode === 429 || 
                errorMsg.toLowerCase().includes('rate limit') || 
                errorMsg.toLowerCase().includes('too many requests')) {
                results.errors.push(`HubSpot API Rate Limit Error: ${errorMsg}`)
                hasMore = false
            } else if (!after) {
                throw new Error(`HubSpot API Error: ${errorMsg}`)
            } else {
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

    return results
}

/**
 * Syncs Slack Channels from Slack API
 */
async function syncSlackChannels(): Promise<{
    created: number
    updated: number
    errors: string[]
}> {
    const slack = new WebClient(getRequiredEnv('SLACK_BOT_TOKEN'))

    const allSlackChannels: any[] = []
    let cursor: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
        try {
            const listParams: any = {
                types: 'public_channel,private_channel',
                exclude_archived: true
            }
            if (cursor) {
                listParams.cursor = cursor
            }
            const slackChannelsResponse = await slack.conversations.list(listParams)
            
            const channels = slackChannelsResponse.channels || []
            allSlackChannels.push(...channels)
            
            cursor = slackChannelsResponse.response_metadata?.next_cursor
            hasMore = !!cursor && cursor.length > 0
        } catch (slackError: any) {
            if (!cursor) {
                throw slackError
            } else {
                console.error('[Slack API] Error fetching additional pages:', {
                    error: slackError.data?.error || slackError.message,
                    cursor
                })
                hasMore = false
                break
            }
        }
    }

    const results = {
        created: 0,
        updated: 0,
        errors: [] as string[]
    }

    for (const slackChannel of allSlackChannels) {
        try {
            const channelId = slackChannel.id
            const name = slackChannel.name || null

            if (!channelId) {
                results.errors.push(`Skipped channel: No channel ID`)
                continue
            }

            const existingChannel = await prisma.slackChannel.findUnique({
                where: { channelId }
            })

            if (existingChannel) {
                const updateData: any = {}
                if (name && name !== existingChannel.name) {
                    updateData.name = name
                }
                if (Object.keys(updateData).length > 0) {
                    await prisma.slackChannel.update({
                        where: { id: existingChannel.id },
                        data: updateData
                    })
                    results.updated++
                }
            } else {
                try {
                    await prisma.slackChannel.create({
                        data: {
                            channelId,
                            name: name || null
                        }
                    })
                    results.created++
                } catch (createError: any) {
                    if (createError.code === 'P2002') {
                        results.errors.push(`Skipped ${name || channelId}: Duplicate entry`)
                    } else {
                        throw createError
                    }
                }
            }
        } catch (error: any) {
            const errorMsg = error.code === 'P2002' 
                ? `Duplicate entry`
                : error.message || 'Unknown error'
            results.errors.push(`Error processing ${slackChannel.name || slackChannel.id}: ${errorMsg}`)
            console.error(`Error processing Slack channel ${slackChannel.id}:`, error)
        }
    }

    return results
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle Vercel Cron (GET)
    const isVercelCron = req.headers['x-vercel-cron'] === '1'
    
    if (req.method === 'GET') {
        // If CRON_SECRET is set, verify it matches (unless it's a Vercel cron)
        if (process.env.CRON_SECRET && !isVercelCron) {
            const authHeader = req.headers.authorization || ''
            const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
            if (authHeader !== expectedAuth) {
                console.error('[CRON] Unauthorized: Missing or invalid CRON_SECRET')
                return res.status(401).json({ error: 'Unauthorized' })
            }
        }
        // Log cron execution
        console.log('[CRON] Data sync cron job triggered', {
            isVercelCron,
            hasAuth: !!req.headers.authorization,
            hasVercelHeader: !!req.headers['x-vercel-cron']
        })
    } else if (req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    try {
        const startTime = Date.now()
        console.log('[CRON] Starting data sync (HubSpot Companies and Slack Channels)')

        // Sync HubSpot Companies
        console.log('[CRON] Syncing HubSpot Companies...')
        const hubspotResults = await syncHubSpotCompanies()
        console.log('[CRON] HubSpot Companies sync completed:', hubspotResults)

        // Sync Slack Channels
        console.log('[CRON] Syncing Slack Channels...')
        const slackResults = await syncSlackChannels()
        console.log('[CRON] Slack Channels sync completed:', slackResults)

        const duration = Date.now() - startTime

        return res.status(200).json({
            message: 'Data sync completed',
            duration: `${duration}ms`,
            hubspot: {
                created: hubspotResults.created,
                updated: hubspotResults.updated,
                deleted: hubspotResults.deleted,
                errors: hubspotResults.errors.length,
                errorDetails: hubspotResults.errors
            },
            slack: {
                created: slackResults.created,
                updated: slackResults.updated,
                errors: slackResults.errors.length,
                errorDetails: slackResults.errors
            }
        })
    } catch (error: any) {
        console.error('[CRON] Data sync error:', error)
        console.error('[CRON] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        })
        
        handleError(error, res)
    }
}



