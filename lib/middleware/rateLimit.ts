import type { NextApiRequest, NextApiResponse } from 'next'
import { LRUCache } from 'lru-cache'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    /**
     * Time window in milliseconds (default: 15 minutes)
     */
    windowMs?: number
    /**
     * Maximum number of requests per window (default: 100)
     */
    max?: number
    /**
     * Message to return when rate limit is exceeded (default: 'Too many requests')
     */
    message?: string
    /**
     * Whether to skip rate limiting for authenticated users (default: false)
     * Note: This still tracks requests, but doesn't enforce limits
     */
    skipSuccessfulRequests?: boolean
    /**
     * Custom key generator function (default: uses IP address)
     */
    keyGenerator?: (req: NextApiRequest) => string
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    reset: number
    message?: string
}

/**
 * In-memory store for rate limiting
 * In production with multiple instances, consider using Redis (e.g., @upstash/ratelimit)
 */
const rateLimitStore = new LRUCache<string, { count: number; resetTime: number }>({
    max: 10000, // Maximum number of unique IPs to track
    ttl: 15 * 60 * 1000, // 15 minutes default TTL
})

/**
 * Gets the client IP address from the request
 */
function getClientIp(req: NextApiRequest): string {
    // Check for forwarded IP (from proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
        const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
        return ips.trim()
    }
    
    // Check for real IP header
    const realIp = req.headers['x-real-ip']
    if (realIp) {
        return Array.isArray(realIp) ? realIp[0] : realIp
    }
    
    // Fallback to connection remote address
    return req.socket?.remoteAddress || 'unknown'
}

/**
 * Creates a rate limiting middleware function
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // 100 requests per window
        message = 'Too many requests, please try again later',
        keyGenerator = (req) => getClientIp(req),
    } = config

    return async function rateLimit(
        req: NextApiRequest,
        res: NextApiResponse
    ): Promise<RateLimitResult | null> {
        const key = keyGenerator(req)
        const now = Date.now()
        
        // Get current rate limit data
        const existing = rateLimitStore.get(key)
        
        let count = 1
        let resetTime = now + windowMs
        
        if (existing) {
            // If within the same window, increment count
            if (existing.resetTime > now) {
                count = existing.count + 1
                resetTime = existing.resetTime
            } else {
                // New window, reset count
                count = 1
                resetTime = now + windowMs
            }
        }
        
        // Store updated count
        rateLimitStore.set(key, { count, resetTime })
        
        // Set rate limit headers (RFC 6585)
        res.setHeader('X-RateLimit-Limit', max.toString())
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count).toString())
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())
        
        // Check if limit exceeded
        if (count > max) {
            res.status(429).json({
                error: message,
                retryAfter: Math.ceil((resetTime - now) / 1000), // seconds until reset
            })
            
            return {
                success: false,
                limit: max,
                remaining: 0,
                reset: resetTime,
                message,
            }
        }
        
        return {
            success: true,
            limit: max,
            remaining: max - count,
            reset: resetTime,
        }
    }
}

/**
 * Default rate limiter: 100 requests per 15 minutes per IP
 */
export const defaultRateLimiter = createRateLimiter()

/**
 * Strict rate limiter: 20 requests per 15 minutes per IP
 * Use for sensitive endpoints (e.g., authentication, data mutations)
 */
export const strictRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many requests. Please slow down and try again later.',
})

/**
 * Lenient rate limiter: 500 requests per 15 minutes per IP
 * Use for read-only endpoints that are frequently accessed
 */
export const lenientRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 500,
})

/**
 * Rate limiter that uses user ID instead of IP
 * Useful for authenticated endpoints where you want to limit per user
 */
export function createUserRateLimiter(config: RateLimitConfig = {}) {
    return createRateLimiter({
        ...config,
        keyGenerator: (req: NextApiRequest) => {
            // Try to get user ID from session or token
            const userId = (req as any).session?.user?.id || 
                          req.headers['x-user-id'] || 
                          getClientIp(req)
            return `user:${userId}`
        },
    })
}

