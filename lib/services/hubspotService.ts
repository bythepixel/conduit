import { Client as HubSpotClient } from '@hubspot/api-client'
import { getRequiredEnv } from '../config/env'

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

