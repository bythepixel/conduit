import type { NextApiResponse } from 'next'
import { ERROR_MESSAGES, PRISMA_ERROR_CODES } from '../constants'

/**
 * Handles Prisma-specific errors and returns appropriate HTTP responses
 */
export function handlePrismaError(error: any, res: NextApiResponse): boolean {
    if (error.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT) {
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
 * Handles general errors and returns appropriate HTTP responses
 */
export function handleError(error: any, res: NextApiResponse): void {
    // Try Prisma error handler first
    if (handlePrismaError(error, res)) {
        return
    }
    
    // Handle other known error types
    if (error.message?.includes('updateMany') || error.message?.includes('undefined')) {
        res.status(500).json({ 
            error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate' 
        })
        return
    }
    
    // Default error response
    res.status(500).json({ error: error.message || ERROR_MESSAGES.INTERNAL_ERROR })
}




