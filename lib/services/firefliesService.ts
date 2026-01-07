import { prisma } from '../prisma'
import { getEnv } from '../config/env'
import { syncMeetingNoteToHubSpot } from './hubspotService'

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
                const errorMessage = 'No meeting ID in fire hook log'
                await this.logError(logId, errorMessage)
                return { success: false, error: errorMessage }
            }

            const result = await this.fetchAndSyncMeeting(fireHookLog.meetingId)

            if (result.success) {
                // Mark log as processed
                await prisma.fireHookLog.update({
                    where: { id: logId },
                    data: {
                        processed: true,
                        errorMessage: null
                    }
                })
                console.log(`[FirefliesService] Successfully processed log ID: ${logId}`)
            } else if (result.error) {
                await this.logError(logId, result.error)
            }

            return result

        } catch (error: any) {
            console.error(`[FirefliesService] Error processing log ID ${logId}:`, error)
            const errorMessage = error.message || 'Unknown error'
            await this.logError(logId, errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    /**
     * Fetches meeting details from Fireflies by meetingId and syncs them to the MeetingNote model.
     * Does not require a FireHookLog.
     */
    static async fetchAndSyncMeeting(meetingId: string): Promise<ProcessLogResult> {
        try {
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
                        notes
                        summary {
                            action_items
                            outline
                            keywords
                            overview
                            gist
                            bullet_gist
                            shorthand_bullet
                        }
                        participants
                        duration
                        date
                    }
                }
            `

            console.log(`[FirefliesService] Attempting to fetch meeting ${meetingId} from Fireflies API`)

            let response = await fetch(FIREFLIES_GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    query: queryById,
                    variables: { id: meetingId }
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
                            notes
                            summary {
                                action_items
                                outline
                                keywords
                                overview
                                gist
                                bullet_gist
                                shorthand_bullet
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
                        variables: { limit: 50 }
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    return { success: false, error: `Firefly API Error: ${response.status}` }
                }

                const result = await response.json()

                if (result.errors) {
                    return { success: false, error: 'Firefly GraphQL Error' }
                }

                const transcripts = result.data?.transcripts || []
                transcript = transcripts.find((t: any) => t.id === meetingId)
            }

            if (!transcript) {
                return { success: false, error: `Meeting not found in Fireflies: ${meetingId}` }
            }

            // Extract participants
            let participants: string[] = []
            if (Array.isArray(transcript.participants)) {
                const rawParticipants = transcript.participants.filter((p: any) => typeof p === 'string' && p.trim() !== '')
                const individuals = rawParticipants.filter((p: string) => !p.includes(','))
                const resultSet = new Set<string>()

                rawParticipants.forEach((p: string) => {
                    if (p.includes(',')) {
                        const fragments = p.split(',').map((f: string) => f.trim()).filter((f: string) => f !== '')
                        const isList = fragments.some((f: string) =>
                            f.includes('@') ||
                            individuals.some((ind: string) => ind.trim() === f)
                        )

                        if (isList) {
                            fragments.forEach((f: string) => resultSet.add(f))
                        } else {
                            resultSet.add(p)
                        }
                    } else {
                        resultSet.add(p)
                    }
                })
                participants = Array.from(resultSet)
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

            // Handle notes - prefer the notes field from API, fallback to summary fields
            let notesText: string | null = null
            if (transcript.notes) {
                // Use the notes field directly from the API
                notesText = transcript.notes
            } else if (transcript.summary) {
                // Fallback to summary fields if notes field is not available
                if (transcript.summary.overview) {
                    notesText = transcript.summary.overview
                } else if (transcript.summary.bullet_gist && Array.isArray(transcript.summary.bullet_gist)) {
                    notesText = transcript.summary.bullet_gist.join('\n')
                } else if (transcript.summary.gist) {
                    notesText = transcript.summary.gist
                } else if (transcript.summary.shorthand_bullet && Array.isArray(transcript.summary.shorthand_bullet)) {
                    notesText = transcript.summary.shorthand_bullet.join('\n')
                }
            }

            // Look for a matching HubSpot company based on the first word of the title
            const hubspotCompanyId = await this.findMatchingCompany(transcript.title)

            // Create or Update MeetingNote
            const noteData: any = {
                title: transcript.title || null,
                notes: notesText,
                transcriptUrl: transcriptUrl,
                summary: summaryText,
                participants: participants,
                duration: transcript.duration ? Math.round(transcript.duration) : null,
                meetingDate: meetingDate,
                hubspotCompanyId: hubspotCompanyId ?? null,
            }

            // Check if meeting note already exists
            const existingNote = await prisma.meetingNote.findUnique({
                where: { meetingId: meetingId }
            })

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
                        meetingId: meetingId,
                        ...noteData
                    }
                })
            }

            // Auto-sync to HubSpot if:
            // 1. Meeting note has a HubSpot company relationship (check the actual meeting note's hubspotCompanyId)
            // 2. All participants are internal (have bythepixel.com email addresses)
            if (meetingNote.hubspotCompanyId && this.isInternalMeeting(participants)) {
                try {
                    console.log(`[FirefliesService] Auto-syncing internal meeting ${meetingId} to HubSpot`)
                    await syncMeetingNoteToHubSpot(meetingNote.id)
                    console.log(`[FirefliesService] Successfully auto-synced meeting ${meetingId} to HubSpot`)
                } catch (syncError: any) {
                    // Log error but don't fail the entire process
                    console.error(`[FirefliesService] Failed to auto-sync meeting ${meetingId} to HubSpot:`, syncError.message)
                }
            }

            return { success: true, meetingNoteId: meetingNote.id }

        } catch (error: any) {
            console.error(`[FirefliesService] Error syncing meeting ${meetingId}:`, error)
            return { success: false, error: error.message || 'Sync failed' }
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

    /**
     * Checks if a meeting is internal (all participants have bythepixel.com email addresses).
     * Returns true if all participants are internal, false otherwise.
     * If there are no participants, returns false.
     * A participant is considered internal if they have a bythepixel.com email address.
     */
    static isInternalMeeting(participants: string[]): boolean {
        if (!participants || participants.length === 0) {
            return false
        }

        // Check if all participants have bythepixel.com email addresses
        return participants.every(participant => {
            // Participant can be a name, email, or combination (e.g., "John Doe <john@bythepixel.com>")
            // Extract email addresses from the participant string
            const emailRegex = /[\w.-]+@([\w.-]+)/gi
            const matches = participant.match(emailRegex)
            
            // If no email found, participant is not internal (can't verify)
            if (!matches || matches.length === 0) {
                return false
            }
            
            // All emails must be from bythepixel.com domain
            return matches.every(email => {
                const domain = email.split('@')[1]?.toLowerCase()
                return domain === 'bythepixel.com'
            })
        })
    }

    /**
     * Finds a matching HubSpot company based on the first word of the meeting title.
     * Match is case-insensitive against company abbreviations.
     * Strips common punctuation from the first word to improve matching.
     */
    static async findMatchingCompany(title: string | null): Promise<number | null> {
        if (!title) return null

        // Get the first word, cleaned of punctuation and whitespace
        const firstWord = title.trim().split(/\s+/)[0]
        if (!firstWord) return null

        // Remove common punctuation characters that might be attached to the abbreviation
        // e.g., "BTPM:" or "BTPM," should match "BTPM"
        const cleanedWord = firstWord.replace(/[.,:;!?|()\[\]{}'"]+$/, '').trim()
        if (!cleanedWord) return null

        const company = await prisma.hubspotCompany.findFirst({
            where: {
                btpAbbreviation: {
                    equals: cleanedWord,
                    mode: 'insensitive'
                }
            },
            select: { id: true }
        })

        return company?.id || null
    }
}
