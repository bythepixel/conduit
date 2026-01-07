import { createRateLimiter, defaultRateLimiter, strictRateLimiter, lenientRateLimiter } from '../../../lib/middleware/rateLimit'
import type { NextApiRequest, NextApiResponse } from 'next'

describe('Rate Limiting Middleware', () => {
    let mockReq: Partial<NextApiRequest>
    let mockRes: Partial<NextApiResponse>
    let setHeaderSpy: jest.Mock
    let statusSpy: jest.Mock
    let jsonSpy: jest.Mock

    beforeEach(() => {
        setHeaderSpy = jest.fn()
        statusSpy = jest.fn().mockReturnThis()
        jsonSpy = jest.fn()

        mockReq = {
            headers: {
                'x-forwarded-for': '192.168.1.1',
            },
            socket: {
                remoteAddress: '192.168.1.1',
            },
        } as Partial<NextApiRequest>

        mockRes = {
            setHeader: setHeaderSpy,
            status: statusSpy,
            json: jsonSpy,
        } as Partial<NextApiResponse>
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('defaultRateLimiter', () => {
        it('should allow requests within limit', async () => {
            const limiter = createRateLimiter({ max: 5, windowMs: 60000 })
            
            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
                expect(result?.success).toBe(true)
                expect(result?.remaining).toBeGreaterThanOrEqual(0)
            }

            // Should have set rate limit headers
            expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Limit', '5')
            expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
            expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
        })

        it('should block requests exceeding limit', async () => {
            const limiter = createRateLimiter({ max: 2, windowMs: 60000 })
            
            // Make 2 requests (within limit)
            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)

            // Third request should be blocked
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false)
            expect(result?.remaining).toBe(0)
            expect(statusSpy).toHaveBeenCalledWith(429)
            expect(jsonSpy).toHaveBeenCalledWith({
                error: 'Too many requests, please try again later',
                retryAfter: expect.any(Number),
            })
        })

        it('should reset count after window expires', async () => {
            const limiter = createRateLimiter({ max: 2, windowMs: 100 }) // 100ms window
            mockReq.headers = { 'x-forwarded-for': '192.168.1.50' }
            
            // Make 2 requests (within limit)
            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)

            // Third request should be blocked
            const blockedResult = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(blockedResult?.success).toBe(false)

            // Wait for window to expire (add buffer for timing)
            await new Promise(resolve => setTimeout(resolve, 200))

            // Request should now be allowed (new window)
            const allowedResult = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(allowedResult?.success).toBe(true)
        })
    })

    describe('strictRateLimiter', () => {
        it('should have lower limit', async () => {
            const limiter = strictRateLimiter
            mockReq.headers = { 'x-forwarded-for': '192.168.1.100' }
            
            // Make 20 requests (within strict limit)
            for (let i = 0; i < 20; i++) {
                const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
                expect(result?.success).toBe(true)
            }

            // 21st request should be blocked
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false)
        })
    })

    describe('lenientRateLimiter', () => {
        it('should have higher limit', async () => {
            const limiter = lenientRateLimiter
            mockReq.headers = { 'x-forwarded-for': '192.168.1.200' }
            
            // Make 10 requests to verify it works (testing full 500 would be slow)
            for (let i = 0; i < 10; i++) {
                const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
                expect(result?.success).toBe(true)
                expect(result?.limit).toBe(500)
            }
        })
    })

    describe('IP address detection', () => {
        it('should use x-forwarded-for header when available', async () => {
            const limiter = createRateLimiter({ max: 1, windowMs: 60000 })
            
            mockReq.headers = {
                'x-forwarded-for': '10.0.0.1',
            }

            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            
            // Should track by the forwarded IP
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false) // Second request blocked
        })

        it('should use x-real-ip header as fallback', async () => {
            const limiter = createRateLimiter({ max: 1, windowMs: 60000 })
            
            mockReq.headers = {
                'x-real-ip': '10.0.0.2',
            }

            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false)
        })

        it('should use socket remoteAddress as last resort', async () => {
            const limiter = createRateLimiter({ max: 1, windowMs: 60000 })
            
            mockReq.headers = {}
            mockReq.socket = {
                remoteAddress: '10.0.0.3',
            } as any

            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false)
        })
    })

    describe('custom key generator', () => {
        it('should use custom key generator when provided', async () => {
            const customKeyGenerator = jest.fn(() => 'custom-key')
            const limiter = createRateLimiter({
                max: 1,
                windowMs: 60000,
                keyGenerator: customKeyGenerator,
            })

            await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            
            expect(customKeyGenerator).toHaveBeenCalledWith(mockReq)
            
            // Second request with same key should be blocked
            const result = await limiter(mockReq as NextApiRequest, mockRes as NextApiResponse)
            expect(result?.success).toBe(false)
        })
    })
})

