import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Gets the allowed origins from environment variables
 */
function getAllowedOrigins(): string[] {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || ''
    const origins = allowedOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
    
    // In development, allow localhost
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment) {
        return [...origins, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean)
    }
    
    return origins.length > 0 ? origins : []
}

/**
 * Gets the origin from the request
 */
function getOrigin(req: NextApiRequest): string | undefined {
    return req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/')
}

/**
 * Checks if the request origin is allowed
 */
function isOriginAllowed(req: NextApiRequest): boolean {
    const allowedOrigins = getAllowedOrigins()
    
    // If no origins configured, allow all in development, deny in production
    if (allowedOrigins.length === 0) {
        return process.env.NODE_ENV === 'development'
    }
    
    const origin = getOrigin(req)
    if (!origin) {
        // Same-origin requests (no origin header) are always allowed
        return true
    }
    
    return allowedOrigins.includes(origin)
}

/**
 * Sets CORS headers on the response
 */
function setCorsHeaders(req: NextApiRequest, res: NextApiResponse): void {
    const allowedOrigins = getAllowedOrigins()
    const origin = getOrigin(req)
    
    // Determine the origin to allow
    let allowedOrigin: string
    if (allowedOrigins.length === 0) {
        // No origins configured - allow all in dev, deny in production
        allowedOrigin = process.env.NODE_ENV === 'development' ? '*' : ''
    } else if (allowedOrigins.length === 1) {
        // Single origin - use it
        allowedOrigin = allowedOrigins[0]
    } else {
        // Multiple origins - check if request origin is allowed
        allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
    }
    
    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-hub-signature')
    res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
}

/**
 * Handles CORS preflight (OPTIONS) requests
 */
export function handleCors(req: NextApiRequest, res: NextApiResponse): boolean {
    // Set CORS headers
    setCorsHeaders(req, res)
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        // Check if origin is allowed
        if (!isOriginAllowed(req)) {
            res.status(403).json({ error: 'Origin not allowed' })
            return true // Handled
        }
        
        res.status(200).end()
        return true // Handled
    }
    
    // For non-OPTIONS requests, check origin and set headers
    if (req.method !== 'OPTIONS' && !isOriginAllowed(req)) {
        // Only block in production if origins are configured
        const allowedOrigins = getAllowedOrigins()
        if (allowedOrigins.length > 0 && process.env.NODE_ENV === 'production') {
            res.status(403).json({ error: 'Origin not allowed' })
            return true // Handled
        }
    }
    
    return false // Not handled, continue with request
}

/**
 * CORS middleware that can be used in API routes
 * Call this before processing the request
 */
export function corsMiddleware(
    req: NextApiRequest,
    res: NextApiResponse
): boolean {
    return handleCors(req, res)
}

