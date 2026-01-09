import { Client as HubSpotClient } from '@hubspot/api-client'
import { getRequiredEnv, getEnv } from '../../config/env'
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

/**
 * Creates a deal in HubSpot from a Harvest invoice
 * Uses the HarvestCompanyMapping to find the associated HubSpot company
 */
export async function createDealFromHarvestInvoice(invoiceId: number): Promise<{ dealId: string, companyId: string }> {
    try {
        // Fetch the invoice
        const invoice = await prisma.harvestInvoice.findUnique({
            where: { id: invoiceId }
        })

        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`)
        }

        // Prevent creating deals for draft invoices
        if (invoice.state && invoice.state.toLowerCase() === 'draft') {
            throw new Error(`Cannot create a deal for an invoice in Draft state. Please wait until the invoice is sent.`)
        }

        // Determine the Harvest client ID from the invoice
        // First try harvestCompanyId, then fall back to clientId
        let harvestClientId: string | null = null
        
        if (invoice.harvestCompanyId) {
            // Invoice has a direct link to HarvestCompany
            const harvestCompany = await prisma.harvestCompany.findUnique({
                where: { id: invoice.harvestCompanyId }
            })
            if (harvestCompany) {
                harvestClientId = harvestCompany.harvestId
            }
        } else if (invoice.clientId) {
            // Invoice has clientId, use it directly
            harvestClientId = invoice.clientId
        }

        if (!harvestClientId) {
            throw new Error(`Invoice does not have a Harvest client ID. Please sync the invoice or ensure it has a clientId.`)
        }

        // Find the HarvestCompany by harvestId (clientId)
        const harvestCompany = await prisma.harvestCompany.findUnique({
            where: { harvestId: harvestClientId },
            include: {
                mappings: {
                    include: {
                        hubspotCompany: true
                    }
                }
            }
        })

        if (!harvestCompany) {
            throw new Error(`Harvest company with ID "${harvestClientId}" not found in database. Please sync Harvest companies first.`)
        }

        if (!harvestCompany.mappings || harvestCompany.mappings.length === 0) {
            throw new Error(`Harvest company "${harvestCompany.name || harvestCompany.harvestId}" is not mapped to any HubSpot company. Please create a mapping first.`)
        }

        // Use the first mapping (if multiple exist, use the first one)
        const mapping = harvestCompany.mappings[0]
        const hubspotCompany = mapping.hubspotCompany

        if (!hubspotCompany.companyId) {
            throw new Error(`HubSpot Company does not have a companyId`)
        }

        // Fetch the full HubSpot company to get the ownerId
        const fullHubspotCompany = await prisma.hubspotCompany.findUnique({
            where: { companyId: hubspotCompany.companyId }
        })

        console.log(`[HubSpot API] Creating deal from invoice ${invoiceId} for company ${hubspotCompany.companyId}`)
        const hubspot = getHubSpotClient()

        // Format deal name from invoice
        const dealName = invoice.subject || 
                        `Invoice ${invoice.number || invoice.harvestId}` ||
                        `Harvest Invoice ${invoice.harvestId}`

        // Map invoice state to deal stage
        const invoiceSentStageId = getEnv('HUBSPOT_DEAL_STAGE_INVOICE_SENT', '1269293330')
        const invoicePaidStageId = getEnv('HUBSPOT_DEAL_STAGE_INVOICE_PAID', '1269293338')
        
        let dealStage = invoiceSentStageId // Default stage: Invoice Sent
        if (invoice.state) {
            const stateLower = invoice.state.toLowerCase()
            if (stateLower === 'open') {
                dealStage = invoiceSentStageId // Invoice Sent
            } else if (stateLower === 'paid') {
                dealStage = invoicePaidStageId // Invoice Paid (Closed)
            }
        }

        // Prepare deal properties
        const dealProperties: any = {
            dealname: dealName,
            amount: invoice.amount ? invoice.amount.toString() : undefined,
            dealstage: dealStage,
            // Use Partner Pipeline (configurable via env). Fallback to 'default' if not set.
            pipeline: getEnv('HUBSPOT_PARTNER_PIPELINE_ID', 'default'),
            dealtype: 'existingbusiness',
        }

        // Add owner ID if available from the HubSpot company
        if (fullHubspotCompany?.ownerId) {
            dealProperties.hubspot_owner_id = fullHubspotCompany.ownerId
        }

        // Add issue date if available
        if (invoice.issueDate) {
            dealProperties.createdate = new Date(invoice.issueDate).toISOString()
        }

        // Add paid date if available (only set closedate if invoice is paid)
        if (invoice.paidDate) {
            dealProperties.closedate = new Date(invoice.paidDate).toISOString()
        }

        // Add currency if available
        if (invoice.currency) {
            dealProperties.deal_currency_code = invoice.currency
        }

        // Remove undefined values
        Object.keys(dealProperties).forEach(key => {
            if (dealProperties[key] === undefined) {
                delete dealProperties[key]
            }
        })

        // Create the deal
        const dealResponse = await hubspot.crm.deals.basicApi.create({
            properties: dealProperties,
            associations: [
                {
                    to: { id: hubspotCompany.companyId },
                    types: [{
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: 5 // Deal to Company association
                    }]
                }
            ]
        })

        const dealId = dealResponse.id

        console.log(`[HubSpot API] Successfully created deal ${dealId} from invoice ${invoiceId}`)

        // Save the deal ID to the invoice
        await prisma.harvestInvoice.update({
            where: { id: invoiceId },
            data: { hubspotDealId: dealId.toString() }
        })

        // Optionally, add invoice details as a note
        if (invoice.notes || invoice.subject) {
            try {
                const noteBody = [
                    invoice.subject ? `<p><strong>Invoice Subject:</strong> ${invoice.subject}</p>` : '',
                    invoice.number ? `<p><strong>Invoice Number:</strong> ${invoice.number}</p>` : '',
                    invoice.amount ? `<p><strong>Amount:</strong> ${invoice.currency || 'USD'} ${invoice.amount}</p>` : '',
                    invoice.state ? `<p><strong>Status:</strong> ${invoice.state}</p>` : '',
                    invoice.issueDate ? `<p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>` : '',
                    invoice.paidDate ? `<p><strong>Paid Date:</strong> ${new Date(invoice.paidDate).toLocaleDateString()}</p>` : '',
                    invoice.notes ? `<p><strong>Notes:</strong><br>${invoice.notes.replace(/\n/g, '<br>')}</p>` : '',
                    `<p><strong>Source:</strong> Harvest Invoice ${invoice.harvestId}</p>`
                ].filter(Boolean).join('')

                await hubspot.crm.objects.notes.basicApi.create({
                    properties: {
                        hs_timestamp: Date.now().toString(),
                        hs_note_body: noteBody
                    },
                    associations: [
                        {
                            to: { id: dealId },
                            types: [{
                                associationCategory: 'HUBSPOT_DEFINED',
                                associationTypeId: 214 // Note to Deal association
                            }]
                        },
                        {
                            to: { id: hubspotCompany.companyId },
                            types: [{
                                associationCategory: 'HUBSPOT_DEFINED',
                                associationTypeId: 190 // Note to Company association
                            }]
                        }
                    ]
                })
            } catch (noteError: any) {
                // Log but don't fail if note creation fails
                console.error(`[HubSpot API] Failed to create note for deal ${dealId}:`, noteError)
            }
        }

        return {
            dealId: dealId.toString(),
            companyId: hubspotCompany.companyId
        }
    } catch (err: any) {
        const errorCode = err.code || err.statusCode || err.status
        const errorMsg = err.message || err.body?.message || 'Unknown error'
        
        // Rate limit errors
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
        
        console.error(`[HubSpot API] Error creating deal from invoice:`, err)
        throw new Error(`HubSpot API Error: ${errorMsg}`)
    }
}

/**
 * Syncs/updates an existing HubSpot deal with the latest invoice data
 */
export async function syncDealFromHarvestInvoice(invoiceId: number): Promise<{ dealId: string, companyId: string }> {
    try {
        // Fetch the invoice
        const invoice = await prisma.harvestInvoice.findUnique({
            where: { id: invoiceId }
        })

        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`)
        }

        if (!invoice.hubspotDealId) {
            throw new Error(`Invoice does not have an associated HubSpot deal. Please create a deal first.`)
        }

        // Prevent syncing deals for draft invoices
        if (invoice.state && invoice.state.toLowerCase() === 'draft') {
            throw new Error(`Cannot sync a deal for an invoice in Draft state. Please wait until the invoice is sent.`)
        }

        // Determine the Harvest client ID from the invoice
        let harvestClientId: string | null = null
        
        if (invoice.harvestCompanyId) {
            const harvestCompany = await prisma.harvestCompany.findUnique({
                where: { id: invoice.harvestCompanyId }
            })
            if (harvestCompany) {
                harvestClientId = harvestCompany.harvestId
            }
        } else if (invoice.clientId) {
            harvestClientId = invoice.clientId
        }

        if (!harvestClientId) {
            throw new Error(`Invoice does not have a Harvest client ID. Please sync the invoice or ensure it has a clientId.`)
        }

        // Find the HarvestCompany by harvestId
        const harvestCompany = await prisma.harvestCompany.findUnique({
            where: { harvestId: harvestClientId },
            include: {
                mappings: {
                    include: {
                        hubspotCompany: true
                    }
                }
            }
        })

        if (!harvestCompany) {
            throw new Error(`Harvest company with ID "${harvestClientId}" not found in database. Please sync Harvest companies first.`)
        }

        if (!harvestCompany.mappings || harvestCompany.mappings.length === 0) {
            throw new Error(`Harvest company "${harvestCompany.name || harvestCompany.harvestId}" is not mapped to any HubSpot company. Please create a mapping first.`)
        }

        const mapping = harvestCompany.mappings[0]
        const hubspotCompany = mapping.hubspotCompany

        if (!hubspotCompany.companyId) {
            throw new Error(`HubSpot Company does not have a companyId`)
        }

        // Fetch the full HubSpot company to get the ownerId
        const fullHubspotCompany = await prisma.hubspotCompany.findUnique({
            where: { companyId: hubspotCompany.companyId }
        })

        console.log(`[HubSpot API] Syncing deal ${invoice.hubspotDealId} from invoice ${invoiceId}`)
        const hubspot = getHubSpotClient()

        // Format deal name from invoice
        const dealName = invoice.subject || 
                        `Invoice ${invoice.number || invoice.harvestId}` ||
                        `Harvest Invoice ${invoice.harvestId}`

        // Map invoice state to deal stage
        const invoiceSentStageId = getEnv('HUBSPOT_DEAL_STAGE_INVOICE_SENT', '1269293330')
        const invoicePaidStageId = getEnv('HUBSPOT_DEAL_STAGE_INVOICE_PAID', '1269293338')
        
        let dealStage = invoiceSentStageId // Default stage: Invoice Sent
        if (invoice.state) {
            const stateLower = invoice.state.toLowerCase()
            if (stateLower === 'open') {
                dealStage = invoiceSentStageId // Invoice Sent
            } else if (stateLower === 'paid') {
                dealStage = invoicePaidStageId // Invoice Paid (Closed)
            }
        }

        // Prepare deal properties
        const dealProperties: any = {
            dealname: dealName,
            amount: invoice.amount ? invoice.amount.toString() : undefined,
            dealstage: dealStage,
            pipeline: getEnv('HUBSPOT_PARTNER_PIPELINE_ID', 'default'),
            dealtype: 'existingbusiness',
        }

        // Add owner ID if available from the HubSpot company
        if (fullHubspotCompany?.ownerId) {
            dealProperties.hubspot_owner_id = fullHubspotCompany.ownerId
        }

        // Add issue date if available
        if (invoice.issueDate) {
            dealProperties.createdate = new Date(invoice.issueDate).toISOString()
        }

        // Add paid date if available (only set closedate if invoice is paid)
        if (invoice.paidDate) {
            dealProperties.closedate = new Date(invoice.paidDate).toISOString()
        }

        // Add currency if available
        if (invoice.currency) {
            dealProperties.deal_currency_code = invoice.currency
        }

        // Remove undefined values
        Object.keys(dealProperties).forEach(key => {
            if (dealProperties[key] === undefined) {
                delete dealProperties[key]
            }
        })

        // Update the deal
        await hubspot.crm.deals.basicApi.update(invoice.hubspotDealId, {
            properties: dealProperties
        })

        console.log(`[HubSpot API] Successfully synced deal ${invoice.hubspotDealId} from invoice ${invoiceId}`)

        return {
            dealId: invoice.hubspotDealId,
            companyId: hubspotCompany.companyId
        }
    } catch (err: any) {
        const errorCode = err.code || err.statusCode || err.status
        const errorMsg = err.message || err.body?.message || 'Unknown error'
        
        // Rate limit errors
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
        
        console.error(`[HubSpot API] Error syncing deal from invoice:`, err)
        throw new Error(`HubSpot API Error: ${errorMsg}`)
    }
}

