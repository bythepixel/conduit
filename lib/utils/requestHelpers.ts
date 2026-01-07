import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Parses and validates an ID parameter from the request query
 * Returns the parsed ID or null if invalid (and sends error response)
 */
export function parseIdParam(
    id: string | string[] | undefined,
    res: NextApiResponse,
    paramName: string = 'id'
): number | null {
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: `Missing or invalid ${paramName} parameter` })
        return null
    }
    
    const parsed = parseInt(id, 10)
    if (isNaN(parsed)) {
        res.status(400).json({ error: `Invalid ${paramName} format` })
        return null
    }
    
    return parsed
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(
    res: NextApiResponse,
    data: any,
    message?: string,
    statusCode: number = 200
): void {
    const response: any = { ...data }
    if (message) {
        response.message = message
    }
    res.status(statusCode).json(response)
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
    res: NextApiResponse,
    error: string,
    details?: any,
    statusCode: number = 500
): void {
    const response: any = { error }
    if (details) {
        response.details = details
    }
    res.status(statusCode).json(response)
}



