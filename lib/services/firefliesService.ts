import { prisma } from '../prisma'
import { getEnv } from '../config/env'

const FIREFLIES_GRAPHQL_URL = 'https://api.fireflies.ai/graphql'

export interface ProcessLogResult {
    success: boolean
    error?: string
    meetingNoteId?: number
}

export class FirefliesService {
    /**
     * Processes a FireHookLog entry, fetches meeting details from Fireflies,
     * and creates or updates a MeetingNote.
     */
    static async processFireHookLog(logId: number): Promise<ProcessLogResult> {
        try {
            console.log(`[FirefliesService] Starting process for log ID: ${logId}`)

            // Fetch the fire hook log
            const fireHookLog = await prisma.fireHookLog.findUnique({
                where: { id: logId }
            })

            if (!fireHookLog) {
                return { success: false, error: 'Fire hook log not found' }
            }

            if (fireHookLog.processed) {
                return { success: false, error: 'Log has already been processed' }
            }

            if (!fireHookLog.meetingId) {
                return { success: false, error: 'No meeting ID in fire hook log' }
            }

            const apiKey = getEnv('FIREFLIES_API_KEY', '')
            if (!apiKey) {
                return { success: false, error: 'FIREFLIES_API_KEY environment variable is not set' }
            }

            // Fetch the meeting from Fireflies API
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

            console.log(`[FirefliesService] Attempting to fetch meeting ${fireHookLog.meetingId} from Fireflies API`)

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
                    console.log('[FirefliesService] GraphQL errors when fetching by ID:', result.errors)
                } else if (result.data?.transcript) {
                    transcript = result.data.transcript
                    console.log(`[FirefliesService] Successfully fetched meeting by ID: ${transcript.id}`)
                } else {
                    console.log('[FirefliesService] No transcript found in response when fetching by ID')
                }
            } else {
                const errorText = await response.text()
                console.log(`[FirefliesService] HTTP error when fetching by ID (${response.status}):`, errorText)
            }

            // If fetching by ID didn't work (fallback logic from original code)
            if (!transcript) {
                console.log('[FirefliesService] Fetching all transcripts to find matching meeting as fallback')

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
                        variables: { limit: 500 }
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    const errorMessage = `Fireflies API HTTP error: ${response.status} - ${errorText.substring(0, 500)}`
                    await this.logError(logId, errorMessage)
                    return { success: false, error: errorMessage }
                }

                const result = await response.json()

                if (result.errors) {
                    const errorMessage = `Fireflies API GraphQL errors: ${JSON.stringify(result.errors).substring(0, 500)}`
                    await this.logError(logId, errorMessage)
                    return { success: false, error: errorMessage }
                }

                const transcripts = result.data?.transcripts || []
                transcript = transcripts.find((t: any) => t.id === fireHookLog.meetingId)
            }

            if (!transcript) {
                const errorMessage = `Meeting not found in Fireflies API: ${fireHookLog.meetingId}`
                await this.logError(logId, errorMessage)
                return { success: false, error: errorMessage }
            }

            // Extract participants
            let participants: string[] = []
            if (Array.isArray(transcript.participants)) {
                const rawParticipants = transcript.participants.filter((p: any) => typeof p === 'string' && p.trim() !== '')
                const individuals = rawParticipants.filter((p: string) => !p.includes(','))
                const result = new Set<string>()

                rawParticipants.forEach((p: string) => {
                    if (p.includes(',')) {
                        const fragments = p.split(',').map((f: string) => f.trim()).filter((f: string) => f !== '')
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

            const transcriptUrl = transcript.transcript_url || null
            const notes = null

            // Create or Update MeetingNote
            const existingNote = await prisma.meetingNote.findUnique({
                where: { meetingId: fireHookLog.meetingId }
            })

            const noteData = {
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
                meetingNote = await prisma.meetingNote.update({
                    where: { id: existingNote.id },
                    data: noteData
                })
            } else {
                meetingNote = await prisma.meetingNote.create({
                    data: {
                        meetingId: fireHookLog.meetingId,
                        ...noteData
                    }
                })
            }

            // Mark log as processed
            await prisma.fireHookLog.update({
                where: { id: logId },
                data: {
                    processed: true,
                    errorMessage: null
                }
            })

            console.log(`[FirefliesService] Successfully processed log ID: ${logId}`)
            return { success: true, meetingNoteId: meetingNote.id }

        } catch (error: any) {
            console.error(`[FirefliesService] Error processing log ID ${logId}:`, error)
            const errorMessage = error.message || 'Unknown error'
            await this.logError(logId, errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    private static async logError(logId: number, errorMessage: string) {
        try {
            await prisma.fireHookLog.update({
                where: { id: logId },
                data: {
                    errorMessage: errorMessage,
                    processed: false
                }
            })
        } catch (e) {
            console.error('[FirefliesService] Failed to log error to database:', e)
        }
    }
}
