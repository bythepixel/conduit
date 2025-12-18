import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { WebClient } from '@slack/web-api'
import { getRequiredEnv } from '../../../lib/config/env'

const slack = new WebClient(getRequiredEnv('SLACK_BOT_TOKEN'))

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        // Fetch all Slack channels with pagination
        const allSlackChannels: any[] = []
        let cursor: string | undefined = undefined
        let hasMore = true

        while (hasMore) {
            let slackChannelsResponse
            try {
                slackChannelsResponse = await slack.conversations.list({
                    types: 'public_channel,private_channel',
                    exclude_archived: true,
                    ...(cursor && { cursor })
                })
            } catch (slackError: any) {
                const errorCode = slackError.data?.error || slackError.code
                const errorMsg = slackError.data?.error || slackError.message || 'Unknown error'
                
                // Handle missing scope error with detailed message
                if (errorCode === 'missing_scope' || errorMsg === 'missing_scope') {
                    const neededScopes = Array.isArray(slackError.data?.needed) 
                        ? slackError.data.needed 
                        : (slackError.data?.needed ? [slackError.data.needed] : [])
                    const providedScopes = Array.isArray(slackError.data?.provided) 
                        ? slackError.data.provided 
                        : (slackError.data?.provided ? [slackError.data.provided] : [])
                    
                    const defaultNeededScopes = ['channels:read', 'groups:read']
                    const scopeMessage = neededScopes.length > 0 
                        ? `Missing scopes: ${neededScopes.join(', ')}. Please add these scopes to your Slack app's OAuth & Permissions settings and reinstall the app.`
                        : `Missing required OAuth scopes. Please add "${defaultNeededScopes.join('" and "')}" scopes to your Slack app's OAuth & Permissions settings and reinstall the app.`
                    
                    console.error('[Slack API] Missing scope error:', {
                        needed: neededScopes.length > 0 ? neededScopes : defaultNeededScopes,
                        provided: providedScopes,
                        error: slackError.data
                    })
                    
                    return res.status(400).json({ 
                        error: scopeMessage,
                        details: {
                            needed: neededScopes.length > 0 ? neededScopes : defaultNeededScopes,
                            provided: providedScopes,
                            instructions: 'Go to https://api.slack.com/apps → Your App → OAuth & Permissions → Add Bot Token Scopes → Reinstall App'
                        }
                    })
                }
                
                // If it's the first page, return error. Otherwise, log and continue with what we have
                if (!cursor) {
                    throw slackError
                } else {
                    // Log error but continue with partial results
                    console.error('[Slack API] Error fetching additional pages:', {
                        error: slackError.data?.error || slackError.message,
                        cursor
                    })
                    hasMore = false
                    break
                }
            }
            
            const channels = slackChannelsResponse.channels || []
            allSlackChannels.push(...channels)
            
            // Check if there are more pages
            cursor = slackChannelsResponse.response_metadata?.next_cursor
            hasMore = !!cursor && cursor.length > 0
        }
        
        const slackChannels = allSlackChannels

        const results = {
            created: 0,
            updated: 0,
            errors: [] as string[]
        }

        for (const slackChannel of slackChannels) {
            try {
                const channelId = slackChannel.id
                const name = slackChannel.name || null

                if (!channelId) {
                    results.errors.push(`Skipped channel: No channel ID`)
                    continue
                }

                // Check if channel exists by channelId
                const existingChannel = await prisma.slackChannel.findUnique({
                    where: { channelId }
                })

                if (existingChannel) {
                    // Update existing channel - only update name if it's different
                    const updateData: any = {}
                    
                    if (name && name !== existingChannel.name) {
                        updateData.name = name
                    }
                    
                    // Only update if there are changes
                    if (Object.keys(updateData).length > 0) {
                        await prisma.slackChannel.update({
                            where: { id: existingChannel.id },
                            data: updateData
                        })
                        results.updated++
                    }
                } else {
                    // Create new channel
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
                            results.errors.push(`Skipped ${name || channelId}: Duplicate entry (channelId already exists)`)
                        } else {
                            throw createError
                        }
                    }
                }
            } catch (error: any) {
                const errorMsg = error.code === 'P2002' 
                    ? `Duplicate entry (channelId already exists)`
                    : error.message || 'Unknown error'
                results.errors.push(`Error processing ${slackChannel.name || slackChannel.id}: ${errorMsg}`)
                console.error(`Error processing Slack channel ${slackChannel.id}:`, error)
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing channels from Slack:', error)
        
        // Check if it's a scope error
        const errorCode = error.data?.error || error.code
        const errorMsg = error.data?.error || error.message || 'Unknown error'
        
        if (errorCode === 'missing_scope' || errorMsg === 'missing_scope' || errorMsg.includes('missing_scope')) {
            const neededScopes = Array.isArray(error.data?.needed) 
                ? error.data.needed 
                : (error.data?.needed ? [error.data.needed] : [])
            const providedScopes = Array.isArray(error.data?.provided) 
                ? error.data.provided 
                : (error.data?.provided ? [error.data.provided] : [])
            
            // Default scopes if Slack doesn't provide them in the error
            const defaultNeededScopes = ['channels:read', 'groups:read']
            const scopeMessage = neededScopes.length > 0 
                ? `Missing scopes: ${neededScopes.join(', ')}. Please add these scopes to your Slack app's OAuth & Permissions settings and reinstall the app.`
                : `Missing required OAuth scopes. Please add "${defaultNeededScopes.join('" and "')}" scopes to your Slack app's OAuth & Permissions settings and reinstall the app.`
            
            console.error('[Slack API] Missing scope error:', {
                needed: neededScopes.length > 0 ? neededScopes : defaultNeededScopes,
                provided: providedScopes,
                error: error.data
            })
            
            return res.status(400).json({ 
                error: scopeMessage,
                details: {
                    needed: neededScopes.length > 0 ? neededScopes : defaultNeededScopes,
                    provided: providedScopes,
                    instructions: 'Go to https://api.slack.com/apps → Your App → OAuth & Permissions → Add Bot Token Scopes → Reinstall App'
                }
            })
        }
        
        return res.status(500).json({ error: error.message || 'Failed to sync channels from Slack' })
    }
}

