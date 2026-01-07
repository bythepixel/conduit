import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { getEnv } from '../../../lib/config/env'
import { FirefliesService } from '../../../lib/services/fireflies/firefliesService'

const FIREFLIES_GRAPHQL_URL = 'https://api.fireflies.ai/graphql'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const apiKey = getEnv('FIREFLIES_API_KEY', '')
        if (!apiKey) {
            return res.status(400).json({
                error: 'FIREFLIES_API_KEY environment variable is not set'
            })
        }

        const results = {
            created: 0,
            updated: 0,
            errors: [] as string[]
        }

        // Fetch all transcripts from Fireflies.ai using GraphQL
        // Note: Fireflies.ai doesn't support cursor-based pagination on transcripts
        // We'll fetch with a limit and stop when we get fewer results
        let hasMore = true
        const limit = 50
        let fetchedCount = 0

        while (hasMore) {
            try {
                // GraphQL query to fetch transcripts/meetings
                // Based on Fireflies.ai schema:
                // - No 'page' or 'cursor' arguments on transcripts
                // - transcript_text -> transcript_url (may need separate fetch)
                // - summary is a type with subfields (action_items, outline, keywords - no key_points)
                // - participants is [String!] (array of strings)
                // - No metadata field
                // - No pagination field on Query
                const query = `
                    query GetTranscripts($limit: Int) {
                        transcripts(limit: $limit) {
                            id
                            title
                            transcript_url
                            notes
                            summary {
                                action_items
                                outline
                                keywords
                            }
                            participants
                            duration
                            date
                        }
                    }
                `

                const variables = { limit }

                const response = await fetch(FIREFLIES_GRAPHQL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        query,
                        variables
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error(`[Fireflies API] HTTP Error (${response.status}):`, errorText)
                    throw new Error(`Fireflies API HTTP error: ${response.status} - ${errorText}`)
                }

                const result = await response.json()

                // Check for GraphQL errors
                if (result.errors) {
                    console.error('[Fireflies API] GraphQL errors:', result.errors)
                    throw new Error(`Fireflies API GraphQL errors: ${JSON.stringify(result.errors)}`)
                }

                // Extract data from GraphQL response
                const transcripts = result.data?.transcripts || []

                if (transcripts.length === 0) {
                    hasMore = false
                    break
                }

                fetchedCount += transcripts.length

                for (const transcript of transcripts) {
                    try {
                        const meetingId = transcript.id
                        if (!meetingId) {
                            results.errors.push(`Skipped transcript: No meeting ID`)
                            continue
                        }

                        // Extract participants - should be array of strings
                        let participants: string[] = []
                        if (Array.isArray(transcript.participants)) {
                            // Extract participants - expand comma lists and deduplicate
                            const rawParticipants = transcript.participants.filter((p: any) => typeof p === 'string' && p.trim() !== '')
                            const individuals = rawParticipants.filter((p: string) => !p.includes(','))
                            const result = new Set<string>()

                            rawParticipants.forEach((p: string) => {
                                if (p.includes(',')) {
                                    const fragments = p.split(',').map((f: string) => f.trim()).filter((f: string) => f !== '')

                                    // Split if any fragment looks like an email or matches a known individual
                                    const isList = fragments.some((f: string) =>
                                        f.includes('@') ||
                                        individuals.some((ind: string) => ind.trim() === f)
                                    )

                                    if (isList) {
                                        fragments.forEach((f: string) => result.add(f))
                                    } else {
                                        result.add(p)
                                    }
                                } else {
                                    result.add(p)
                                }
                            })
                            participants = Array.from(result)
                        }

                        // Parse meeting date
                        let meetingDate: Date | null = null
                        if (transcript.date) {
                            meetingDate = new Date(transcript.date)
                            if (isNaN(meetingDate.getTime())) {
                                meetingDate = null
                            }
                        }

                        // Check if meeting note exists
                        const existingNote = await prisma.meetingNote.findUnique({
                            where: { meetingId: meetingId.toString() }
                        })

                        // Handle summary - it's an object with subfields
                        // Available fields: action_items, outline, keywords (no key_points)
                        let summaryText: string | null = null
                        if (transcript.summary) {
                            const summaryParts: string[] = []
                            if (transcript.summary.action_items && Array.isArray(transcript.summary.action_items)) {
                                summaryParts.push('Action Items: ' + transcript.summary.action_items.join(', '))
                            }
                            if (transcript.summary.outline) {
                                summaryParts.push('Outline: ' + transcript.summary.outline)
                            }
                            if (transcript.summary.keywords && Array.isArray(transcript.summary.keywords)) {
                                summaryParts.push('Keywords: ' + transcript.summary.keywords.join(', '))
                            }
                            summaryText = summaryParts.length > 0 ? summaryParts.join('\n\n') : null
                        }

                        // Get notes and transcript URL from the transcript
                        const notes = transcript.notes || null
                        const transcriptUrl = transcript.transcript_url || null

                        const noteData: any = {
                            title: transcript.title || null,
                            notes: notes,
                            transcriptUrl: transcriptUrl,
                            summary: summaryText,
                            participants: participants,
                            duration: transcript.duration ? Math.round(transcript.duration) : null,
                            meetingDate: meetingDate,
                        }
                        // Only include metadata if we have data (Prisma requires undefined, not null)
                        // Metadata field doesn't exist in Fireflies schema, so we omit it

                        // Look for a matching HubSpot company based on the first word of the title
                        const hubspotCompanyId = await FirefliesService.findMatchingCompany(transcript.title)

                        if (existingNote) {
                            // Update existing note
                            await prisma.meetingNote.update({
                                where: { id: existingNote.id },
                                data: {
                                    ...noteData,
                                    hubspotCompanyId
                                }
                            })
                            results.updated++
                        } else {
                            // Create new note
                            try {
                                await prisma.meetingNote.create({
                                    data: {
                                        meetingId: meetingId.toString(),
                                        ...noteData,
                                        hubspotCompanyId
                                    }
                                })
                                results.created++
                            } catch (createError: any) {
                                if (createError.code === 'P2002') {
                                    results.errors.push(`Skipped ${transcript.title || meetingId}: Duplicate entry (meetingId already exists)`)
                                } else {
                                    throw createError
                                }
                            }
                        }
                    } catch (error: any) {
                        const errorMsg = error.code === 'P2002'
                            ? `Duplicate entry (meetingId already exists)`
                            : error.message || 'Unknown error'
                        results.errors.push(`Error processing ${transcript.title || transcript.id}: ${errorMsg}`)
                        console.error(`Error processing Fireflies transcript ${transcript.id}:`, error)
                    }
                }

                // Check if there are more pages
                // Since pagination field doesn't exist, check if we got a full page
                // If we got fewer than limit, we're done
                // Otherwise, we might need to use cursor-based pagination
                // For now, we'll stop if we got fewer than limit
                hasMore = transcripts.length >= limit

                // If there's a cursor in the response, use it for next page
                // Otherwise, we'll need to implement date-based pagination
                // For now, let's fetch a reasonable number and stop
                if (fetchedCount >= 1000) { // Limit total fetch to prevent infinite loops
                    hasMore = false
                }

            } catch (apiError: any) {
                const errorMsg = apiError.message || 'Unknown error'

                console.error('[Fireflies API] Error fetching transcripts:', {
                    message: errorMsg,
                    error: apiError
                })

                // If it's the first fetch, return error. Otherwise, log and continue with what we have
                if (fetchedCount === 0) {
                    return res.status(500).json({
                        error: `Fireflies API Error: ${errorMsg}`,
                        details: {
                            message: errorMsg,
                            hint: 'Please check the GraphQL query matches Fireflies.ai schema. You may need to adjust the query fields based on their API documentation.'
                        }
                    })
                } else {
                    // Log error but continue with partial results
                    results.errors.push(`Error fetching additional pages: ${errorMsg}`)
                    hasMore = false
                }
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing meeting notes from Fireflies:', error)
        return res.status(500).json({
            error: error.message || 'Failed to sync meeting notes from Fireflies'
        })
    }
}
