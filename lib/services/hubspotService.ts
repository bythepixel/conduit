import { Client as HubSpotClient } from '@hubspot/api-client'
import { getRequiredEnv } from '../config/env'
import { prisma } from '../prisma'

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
        
        if (errorCode === 429 || 
            errorMsg.toLowerCase().includes('rate limit') || 
            errorMsg.toLowerCase().includes('too many requests')) {
            console.error(`[HubSpot API] Rate limit error: ${errorMsg}`, err)
            throw new Error(`HubSpot API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
        }
        
        console.error(`[HubSpot API] Error creating note:`, err)
        throw new Error(`HubSpot API Error: ${errorMsg}`)
    }
}

/**
 * Formats meeting note data into a formatted note body for HubSpot
 */
function formatMeetingNoteForHubSpot(meetingNote: any): string {
    const parts: string[] = []
    
    // Title
    if (meetingNote.title) {
        parts.push(`**Meeting: ${meetingNote.title}**`)
        parts.push('')
    }
    
    // Meeting Date
    if (meetingNote.meetingDate) {
        const date = new Date(meetingNote.meetingDate)
        parts.push(`**Date:** ${date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`)
    }
    
    // Duration
    if (meetingNote.duration) {
        const hours = Math.floor(meetingNote.duration / 60)
        const minutes = meetingNote.duration % 60
        const durationStr = hours > 0 
            ? `${hours}h ${minutes}m` 
            : `${minutes}m`
        parts.push(`**Duration:** ${durationStr}`)
    }
    
    // Participants
    if (meetingNote.participants && meetingNote.participants.length > 0) {
        parts.push(`**Participants:** ${meetingNote.participants.join(', ')}`)
    }
    
    // Summary
    if (meetingNote.summary) {
        parts.push('')
        parts.push('**Summary:**')
        parts.push(meetingNote.summary)
    }
    
    // Notes
    if (meetingNote.notes) {
        parts.push('')
        parts.push('**Notes:**')
        parts.push(meetingNote.notes)
    }
    
    // Transcript URL
    if (meetingNote.transcriptUrl) {
        parts.push('')
        parts.push(`**Transcript:** ${meetingNote.transcriptUrl}`)
    }
    
    return parts.join('\n')
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

