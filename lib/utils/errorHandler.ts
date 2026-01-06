import type { NextApiResponse } from 'next'
import { ERROR_MESSAGES, PRISMA_ERROR_CODES } from '../constants'

/**
 * Handles Prisma-specific errors and returns appropriate HTTP responses
 * Returns true if the error was handled, false otherwise
 */
export function handlePrismaError(error: any, res: NextApiResponse): boolean {
    if (error.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT) {
        // Try to provide more specific error messages based on the constraint
        const target = error.meta?.target
        if (Array.isArray(target)) {
            if (target.includes('btpAbbreviation')) {
                res.status(400).json({ error: "BTP Abbreviation already exists" })
                return true
            }
            if (target.includes('companyId')) {
                res.status(400).json({ error: "Company ID already exists" })
                return true
            }
            if (target.includes('channelId')) {
                res.status(400).json({ error: "Channel ID already exists" })
                return true
            }
            if (target.includes('email')) {
                res.status(400).json({ error: "Email already exists" })
                return true
            }
            if (target.includes('slackId')) {
                res.status(400).json({ error: "Slack ID already exists" })
                return true
            }
        }
        res.status(400).json({ error: ERROR_MESSAGES.DUPLICATE_ENTRY })
        return true
    }
    
    if (error.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        res.status(404).json({ error: ERROR_MESSAGES.NOT_FOUND })
        return true
    }
    
    return false
}

/**
 * Handles HubSpot API rate limit errors
 */
export function handleHubSpotRateLimitError(error: any, res: NextApiResponse): boolean {
    const errorCode = error.code || error.statusCode || error.status
    const errorMsg = error.message || error.body?.message || ''
    
    if (errorCode === 429 || 
        errorMsg.toLowerCase().includes('rate limit') || 
        errorMsg.toLowerCase().includes('too many requests')) {
        res.status(429).json({ 
            error: `HubSpot API Rate Limit Error: ${errorMsg}. Please try again later.`,
            details: {
                code: errorCode,
                message: errorMsg
            }
        })
        return true
    }
    
    return false
}

/**
 * Handles general errors and returns appropriate HTTP responses
 */
export function handleError(error: any, res: NextApiResponse): void {
    // Try Prisma error handler first
    if (handlePrismaError(error, res)) {
        return
    }
    
    // Try HubSpot rate limit handler
    if (handleHubSpotRateLimitError(error, res)) {
        return
    }
    
    // Handle Prisma client update issues
    if (error.message?.includes('updateMany') || error.message?.includes('undefined')) {
        res.status(500).json({ 
            error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate' 
        })
        return
    }
    
    // Default error response
    res.status(500).json({ 
        error: error.message || ERROR_MESSAGES.INTERNAL_ERROR,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
}





