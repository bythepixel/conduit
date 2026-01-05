import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { getEnv } from '../../../../lib/config/env'

const FIREFLIES_GRAPHQL_URL = 'https://api.fireflies.ai/graphql'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const { id } = req.query
        const logId = parseInt(id as string, 10)

        if (isNaN(logId)) {
            return res.status(400).json({
                error: 'Invalid log ID'
            })
        }

        // Fetch the fire hook log
        const fireHookLog = await prisma.fireHookLog.findUnique({
            where: { id: logId }
        })

        if (!fireHookLog) {
            return res.status(404).json({
                error: 'Fire hook log not found'
            })
        }

        if (fireHookLog.processed) {
            return res.status(400).json({
                error: 'Log has already been processed'
            })
        }

        if (!fireHookLog.meetingId) {
            return res.status(400).json({
                error: 'No meeting ID in fire hook log'
            })
        }

        const apiKey = getEnv('FIREFLIES_API_KEY', '')
        if (!apiKey) {
            return res.status(400).json({
                error: 'FIREFLIES_API_KEY environment variable is not set'
            })
        }

        // Fetch the meeting from Fireflies API
        // Try to fetch by ID first, if that fails, fetch all and filter
        let transcript: any = null

        // First, try fetching by ID
        const queryById = `
            query GetTranscript($id: String!) {
                transcript(id: $id) {
                    id
                    title
                    transcript_url
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

        console.log(`[Process Fire Hook Log] Attempting to fetch meeting ${fireHookLog.meetingId} from Fireflies API`)

        let response = await fetch(FIREFLIES_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: queryById,
                variables: { id: fireHookLog.meetingId }
            })
        })

        if (response.ok) {
            const result = await response.json()

            if (result.errors) {
                console.log('[Process Fire Hook Log] GraphQL errors when fetching by ID:', result.errors)
                // Continue to try fetching all transcripts
            } else if (result.data?.transcript) {
                transcript = result.data.transcript
                console.log(`[Process Fire Hook Log] Successfully fetched meeting by ID: ${transcript.id}`)
            } else {
                console.log('[Process Fire Hook Log] No transcript found in response when fetching by ID')
            }
        } else {
            const errorText = await response.text()
            console.log(`[Process Fire Hook Log] HTTP error when fetching by ID (${response.status}):`, errorText)
            // Continue to try fetching all transcripts
        }

        // If fetching by ID didn't work, fetch all transcripts and filter
        if (!transcript) {
            console.log('[Process Fire Hook Log] Fetching all transcripts to find matching meeting')

            const queryAll = `
                query GetTranscripts($limit: Int) {
                    transcripts(limit: $limit) {
                        id
                        title
                        transcript_url
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

            response = await fetch(FIREFLIES_GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    query: queryAll,
                    variables: { limit: 500 } // Increase limit to find the meeting
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`[Process Fire Hook Log] HTTP Error (${response.status}):`, errorText)

                const errorMessage = `Fireflies API HTTP error: ${response.status} - ${errorText.substring(0, 500)}`
                await prisma.fireHookLog.update({
                    where: { id: logId },
                    data: {
                        errorMessage: errorMessage,
                        processed: false
                    }
                })

                return res.status(500).json({
                    error: 'Failed to fetch meeting from Fireflies API',
                    details: errorText.substring(0, 500)
                })
            }

            const result = await response.json()

            if (result.errors) {
                console.error('[Process Fire Hook Log] GraphQL errors:', result.errors)
                const errorMessage = `Fireflies API GraphQL errors: ${JSON.stringify(result.errors).substring(0, 500)}`

                await prisma.fireHookLog.update({
                    where: { id: logId },
                    data: {
                        errorMessage: errorMessage,
                        processed: false
                    }
                })

                return res.status(500).json({
                    error: 'Failed to fetch meeting from Fireflies API',
                    details: result.errors
                })
            }

            // Find the transcript with matching ID
            const transcripts = result.data?.transcripts || []
            console.log(`[Process Fire Hook Log] Fetched ${transcripts.length} transcripts, searching for meeting ID: ${fireHookLog.meetingId}`)
            transcript = transcripts.find((t: any) => t.id === fireHookLog.meetingId)

            if (transcript) {
                console.log(`[Process Fire Hook Log] Found meeting in transcripts list: ${transcript.id}`)
            } else {
                console.log(`[Process Fire Hook Log] Meeting ID ${fireHookLog.meetingId} not found in ${transcripts.length} transcripts`)
            }
        }

        if (!transcript) {
            const errorMessage = `Meeting not found: ${fireHookLog.meetingId}`
            await prisma.fireHookLog.update({
                where: { id: logId },
                data: {
                    errorMessage: errorMessage,
                    processed: false
                }
            })

            return res.status(404).json({
                error: 'Meeting not found in Fireflies API'
            })
        }

        // Extract participants
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

        // Handle summary
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

        // Get transcript URL (notes field doesn't exist in Fireflies API)
        const transcriptUrl = transcript.transcript_url || null
        const notes = null // Notes field is not available in Fireflies API

        // Check if meeting note already exists
        const existingNote = await prisma.meetingNote.findUnique({
            where: { meetingId: fireHookLog.meetingId }
        })

        const noteData: any = {
            title: transcript.title || null,
            notes: notes,
            transcriptUrl: transcriptUrl,
            summary: summaryText,
            participants: participants,
            duration: transcript.duration ? Math.round(transcript.duration) : null,
            meetingDate: meetingDate,
        }

        let meetingNote
        if (existingNote) {
            // Update existing note
            meetingNote = await prisma.meetingNote.update({
                where: { id: existingNote.id },
                data: noteData
            })
        } else {
            // Create new note
            meetingNote = await prisma.meetingNote.create({
                data: {
                    meetingId: fireHookLog.meetingId,
                    ...noteData
                }
            })
        }

        // Mark fire hook log as processed
        await prisma.fireHookLog.update({
            where: { id: logId },
            data: {
                processed: true,
                errorMessage: null
            }
        })

        return res.status(200).json({
            success: true,
            meetingNote: {
                id: meetingNote.id,
                meetingId: meetingNote.meetingId,
                title: meetingNote.title
            }
        })
    } catch (error: any) {
        console.error('[Process Fire Hook Log] Error:', error)

        // Try to update the fire hook log with error message
        try {
            const { id } = req.query
            const logId = parseInt(id as string, 10)
            if (!isNaN(logId)) {
                await prisma.fireHookLog.update({
                    where: { id: logId },
                    data: {
                        errorMessage: error.message || 'Unknown error occurred',
                        processed: false
                    }
                })
            }
        } catch (updateError) {
            console.error('[Process Fire Hook Log] Failed to update error message:', updateError)
        }

        return res.status(500).json({
            error: 'Failed to process fire hook log',
            details: error.message
        })
    }
}

