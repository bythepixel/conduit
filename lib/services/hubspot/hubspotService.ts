import { Client as HubSpotClient } from '@hubspot/api-client'
import { getRequiredEnv } from '../../config/env'
import { prisma } from '../../prisma'

let hubspotClient: HubSpotClient | null = null

/**
 * Gets or creates the HubSpot Client instance
 */
function getHubSpotClient(): HubSpotClient {
    if (!hubspotClient) {
        const token = getRequiredEnv('HUBSPOT_ACCESS_TOKEN')
        hubspotClient = new HubSpotClient({ accessToken: token })
    }
    return hubspotClient
}

/**
 * Creates a note in HubSpot associated with a company
 */
export async function createCompanyNote(
    companyId: string,
    noteBody: string
): Promise<void> {
    try {
        console.log(`[HubSpot API] Creating note for company ${companyId}`)
        const hubspot = getHubSpotClient()
        await hubspot.crm.objects.notes.basicApi.create({
            properties: {
                hs_timestamp: Date.now().toString(),
                hs_note_body: noteBody
            },
            associations: [
                {
                    to: { id: companyId },
                    types: [{ 
                        associationCategory: 'HUBSPOT_DEFINED', 
                        associationTypeId: 190 
                    }] // 190 is Note to Company
                }
            ]
        })
        console.log(`[HubSpot API] Successfully created note`)
    } catch (err: any) {
        const errorCode = err.code || err.statusCode || err.status
        const errorMsg = err.message || err.body?.message || 'Unknown error'
        
        // Rate limit errors are handled by handleHubSpotRateLimitError in errorHandler
        // Re-throw with a structured error that can be caught by the handler
        if (errorCode === 429 || 
            errorMsg.toLowerCase().includes('rate limit') || 
            errorMsg.toLowerCase().includes('too many requests')) {
            console.error(`[HubSpot API] Rate limit error: ${errorMsg}`, err)
            const rateLimitError: any = new Error(`HubSpot API Rate Limit Error: ${errorMsg}`)
            rateLimitError.code = 429
            rateLimitError.statusCode = 429
            rateLimitError.body = { message: errorMsg }
            throw rateLimitError
        }
        
        console.error(`[HubSpot API] Error creating note:`, err)
        throw new Error(`HubSpot API Error: ${errorMsg}`)
    }
}

/**
 * Formats meeting note data into a formatted note body for HubSpot
 * Uses HTML tags: <p>, <br>, and <strong> for formatting
 */
function formatMeetingNoteForHubSpot(meetingNote: any): string {
    const parts: string[] = []
    
    // Title
    if (meetingNote.title) {
        parts.push(`<p><strong>Meeting: ${meetingNote.title}</strong></p>`)
    }
    
    // Meeting Date
    if (meetingNote.meetingDate) {
        const date = new Date(meetingNote.meetingDate)
        parts.push(`<p><strong>Date:</strong> ${date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>`)
    }
    
    // Duration
    if (meetingNote.duration) {
        const hours = Math.floor(meetingNote.duration / 60)
        const minutes = meetingNote.duration % 60
        const durationStr = hours > 0 
            ? `${hours}h ${minutes}m` 
            : `${minutes}m`
        parts.push(`<p><strong>Duration:</strong> ${durationStr}</p>`)
    }
    
    // Participants
    if (meetingNote.participants && meetingNote.participants.length > 0) {
        parts.push(`<p><strong>Participants:</strong> ${meetingNote.participants.join(', ')}</p>`)
    }
    
    // Summary
    if (meetingNote.summary) {
        // Replace newlines with <br> tags in the summary
        const formattedSummary = meetingNote.summary.replace(/\n/g, '<br>')
        parts.push(`<p><strong>Summary:</strong><br>${formattedSummary}</p>`)
    }
    
    // Notes
    if (meetingNote.notes) {
        // Replace newlines with <br> tags in the notes
        const formattedNotes = meetingNote.notes.replace(/\n/g, '<br>')
        parts.push(`<p><strong>Notes:</strong><br>${formattedNotes}</p>`)
    }
    
    // Transcript URL
    if (meetingNote.transcriptUrl) {
        parts.push(`<p><strong>Transcript:</strong> ${meetingNote.transcriptUrl}</p>`)
    }
    
    return parts.join('')
}

/**
 * Syncs a meeting note to HubSpot
 * Only works if the meeting note has a relationship with a HubSpot Company
 */
export async function syncMeetingNoteToHubSpot(meetingNoteId: number): Promise<void> {
    // Fetch the meeting note with company relationship
    const meetingNote = await prisma.meetingNote.findUnique({
        where: { id: meetingNoteId },
        include: {
            hubspotCompany: true
        }
    })
    
    if (!meetingNote) {
        throw new Error(`Meeting note with ID ${meetingNoteId} not found`)
    }
    
    if (!meetingNote.hubspotCompany) {
        throw new Error(`Meeting note does not have a relationship with a HubSpot Company`)
    }
    
    if (!meetingNote.hubspotCompany.companyId) {
        throw new Error(`HubSpot Company does not have a companyId`)
    }
    
    // Format the meeting note data
    const noteBody = formatMeetingNoteForHubSpot(meetingNote)
    
    // Create the note in HubSpot
    await createCompanyNote(
        meetingNote.hubspotCompany.companyId,
        noteBody
    )
    
    // Update the syncedToHubspot flag
    await prisma.meetingNote.update({
        where: { id: meetingNoteId },
        data: { syncedToHubspot: true }
    })
    
    console.log(`[HubSpot Service] Successfully synced meeting note ${meetingNoteId} to HubSpot`)
}

