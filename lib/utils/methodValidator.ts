import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Validates that the request method is in the allowed list
 * Returns true if valid, false if invalid (and sends 405 response)
 */
export function validateMethod(
    req: NextApiRequest,
    res: NextApiResponse,
    allowedMethods: string[]
): boolean {
    if (!allowedMethods.includes(req.method || '')) {
        res.setHeader('Allow', allowedMethods)
        res.status(405).end(`Method ${req.method} Not Allowed`)
        return false
    }
    return true
}

