import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { WebClient } from '@slack/web-api'
import { Client as HubSpotClient } from '@hubspot/api-client'
import { Configuration, OpenAIApi } from 'openai'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
const hubspot = new HubSpotClient({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN })
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY || 'temp-dummy-key' })
const openai = new OpenAIApi(configuration)

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle Vercel Cron (GET)
    if (req.method === 'GET') {
        const { authorization } = req.headers
        if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
    } else if (req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    try {
        const { mappingId, test } = req.body
        const whereClause = mappingId ? { id: Number(mappingId) } : {}
        const mappings = await prisma.mapping.findMany({ 
            where: whereClause,
            include: {
                slackChannels: {
                    include: {
                        slackChannel: true
                    }
                },
                hubspotCompany: true
            }
        })
        const results = []
        const isTestMode = test === true

        for (const mapping of mappings) {
            // Process each channel in the mapping
            for (const mappingChannel of mapping.slackChannels) {
                try {
                    // 1. Fetch Slack Messages (Last 24 hours)
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)

                    let history
                    try {
                        history = await slack.conversations.history({
                            channel: mappingChannel.slackChannel.channelId,
                            oldest: (yesterday.getTime() / 1000).toString(),
                        })
                    } catch (err: any) {
                        if (err.data?.error === 'not_in_channel') {
                            try {
                                // Helper log
                                console.log(`Bot not in channel ${mappingChannel.slackChannel.channelId}, attempting to join...`)
                                await slack.conversations.join({ channel: mappingChannel.slackChannel.channelId })

                                // Retry fetch
                                history = await slack.conversations.history({
                                    channel: mappingChannel.slackChannel.channelId,
                                    oldest: (yesterday.getTime() / 1000).toString(),
                                })
                            } catch (joinErr: any) {
                                throw new Error(`Slack API Error (Auto-Join Failed): ${joinErr.message}`)
                            }
                        } else {
                            throw new Error(`Slack API Error: ${err.message}`)
                        }
                    }

                    if (!history.messages || history.messages.length === 0) {
                        results.push({ 
                            id: mapping.id, 
                            channelId: mappingChannel.slackChannel.channelId,
                            status: isTestMode ? 'No messages to test' : 'No messages to sync' 
                        })
                        continue
                    }

                // 2. Generate "Summary" (Digest of messages)

                // Fetch all users to map IDs to Names
                let userMap = new Map<string, string>()
                try {
                    const usersList = await slack.users.list()
                    if (usersList.members) {
                        usersList.members.forEach(member => {
                            if (member.id && member.name) {
                                userMap.set(member.id, member.real_name || member.name)
                            }
                        })
                    }
                } catch (e) {
                    console.error('Failed to fetch Slack users', e)
                }

                // 2. Generate "Summary" (ChatGPT)
                const messagesText = history.messages.slice().reverse().map((m: any) => {
                    const userId = m.user || 'Unknown'
                    const userName = userMap.get(userId) || userId
                    const text = m.text || ''
                    return `${userName}: ${text}`
                }).join('\n')

                // Fetch the active prompt from database
                const activePrompt = await prisma.prompt.findFirst({
                    where: { isActive: true }
                })

                // Use active prompt if available, otherwise fallback to default
                const systemPrompt = activePrompt?.content || 'Summarize the following Slack conversation in a short, informative paragraph. The input format is "Name: Message". Use the names in your summary to attribute key points.'

                let summaryContent
                try {
                    const completion = await openai.createChatCompletion({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: messagesText }
                        ],
                        model: 'gpt-3.5-turbo',
                    })
                    summaryContent = `Daily Slack Summary for ${mappingChannel.slackChannel.name || mappingChannel.slackChannel.channelId}:\n\n${completion.data.choices[0].message?.content}`
                } catch (openaiErr: any) {
                    // console.error('OpenAI Error', openaiErr) 
                    // v3 errors often in openaiErr.response.data
                    const msg = openaiErr.response?.data?.error?.message || openaiErr.message
                    // Fallback to simple list
                    const fallbackLines = history.messages.map((m: any) => `- <${m.user || '?'}>: ${m.text || ''}`)
                    summaryContent = `Daily Slack Summary (Fallback): \n\n${fallbackLines.join('\n')}\n\n(ChatGPT Summary Failed: ${msg})`
                }

                // 3. Create Note in HubSpot (skip if test mode)
                if (!isTestMode) {
                    // HubSpot Notes are "Engagements" or CRM Objects.
                    // Using CRM Objects API for Notes

                    const noteInput = {
                        properties: {
                            hs_timestamp: Date.now().toString(),
                            hs_note_body: summaryContent
                        },
                        associations: [
                            {
                                to: { id: mapping.hubspotCompanyId },
                                types: [
                                    { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 } // 190 is Company to Note? Or Note to Company?
                                    // Standard association for Note -> Company is likely needed.
                                    // Actually, creating a note via CRM API v3:
                                ]
                            }
                        ]
                    }

                    // Wait, associating via create is simpler if we know the def.
                    // Note to Company: 'note_to_company'

                    try {
                        await hubspot.crm.objects.notes.basicApi.create({
                            properties: {
                                hs_timestamp: Date.now().toString(),
                                hs_note_body: summaryContent
                            },
                        associations: [
                            {
                                to: { id: mapping.hubspotCompany.companyId },
                                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }] // 190 is Note to Company
                            }
                        ]
                        })
                    } catch (err: any) {
                        throw new Error(`HubSpot API Error: ${err.message}`)
                    }

                    // Update last synced
                    await prisma.mapping.update({
                        where: { id: mapping.id },
                        data: { lastSyncedAt: new Date() }
                    })
                }

                    results.push({
                        id: mapping.id,
                        channelId: mappingChannel.slackChannel.channelId,
                        status: isTestMode ? 'Test Complete' : 'Synced',
                        summary: summaryContent,
                        destination: {
                            name: mapping.hubspotCompany.name,
                            id: mapping.hubspotCompany.companyId
                        }
                    })

                } catch (error: any) {
                    console.error(`Error ${isTestMode ? 'testing' : 'syncing'} mapping ${mapping.id} channel ${mappingChannel.slackChannel.channelId}:`, error)
                    results.push({ 
                        id: mapping.id, 
                        channelId: mappingChannel.slackChannel.channelId,
                        status: 'Failed', 
                        error: error.message 
                    })
                }
            }
        }

        return res.status(200).json({ message: 'Sync process completed', results })

    } catch (error: any) {
        console.error('Sync Error:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
