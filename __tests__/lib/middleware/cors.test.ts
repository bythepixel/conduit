import { corsMiddleware, handleCors } from '../../../lib/middleware/cors'
import type { NextApiRequest, NextApiResponse } from 'next'

describe('CORS Middleware', () => {
    let mockReq: Partial<NextApiRequest>
    let mockRes: Partial<NextApiResponse>
    let setHeaderSpy: jest.Mock
    let statusSpy: jest.Mock
    let jsonSpy: jest.Mock
    let endSpy: jest.Mock

    beforeEach(() => {
        setHeaderSpy = jest.fn()
        statusSpy = jest.fn().mockReturnThis()
        jsonSpy = jest.fn()
        endSpy = jest.fn()

        mockReq = {
            method: 'GET',
            headers: {},
        } as Partial<NextApiRequest>

        mockRes = {
            setHeader: setHeaderSpy,
            status: statusSpy,
            json: jsonSpy,
            end: endSpy,
        } as Partial<NextApiResponse>

        // Reset environment
        delete process.env.ALLOWED_ORIGINS
        delete process.env.NEXT_PUBLIC_APP_URL
        process.env.NODE_ENV = 'test'
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('OPTIONS requests (preflight)', () => {
        it('should handle OPTIONS request and return 200', () => {
            process.env.ALLOWED_ORIGINS = 'https://example.com'
            mockReq.method = 'OPTIONS'
            mockReq.headers = { origin: 'https://example.com' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(true)
            expect(statusSpy).toHaveBeenCalledWith(200)
            expect(endSpy).toHaveBeenCalled()
        })

        it('should set CORS headers on OPTIONS request', () => {
            mockReq.method = 'OPTIONS'
            mockReq.headers = { origin: 'https://example.com' }

            corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')
            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.stringContaining('Content-Type'))
        })
    })

    describe('Origin validation', () => {
        it('should allow requests without origin header (same-origin)', () => {
            mockReq.method = 'GET'
            mockReq.headers = {}

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(false) // Not handled, continue with request
            expect(setHeaderSpy).toHaveBeenCalled()
        })

        it('should allow all origins in development when none configured', () => {
            process.env.NODE_ENV = 'development'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://malicious.com' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(false) // Allowed in development
        })

        it('should block origins not in allowed list in production', () => {
            process.env.NODE_ENV = 'production'
            process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://malicious.com' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(true) // Blocked
            expect(statusSpy).toHaveBeenCalledWith(403)
            expect(jsonSpy).toHaveBeenCalledWith({ error: 'Origin not allowed' })
        })

        it('should allow origins in allowed list', () => {
            process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://example.com' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(false) // Allowed, continue with request
        })
    })

    describe('CORS headers', () => {
        it('should set all required CORS headers', () => {
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://example.com' }

            corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')
            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.any(String))
            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.any(String))
            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Max-Age', '86400')
        })

        it('should set Access-Control-Allow-Origin to request origin when allowed', () => {
            process.env.ALLOWED_ORIGINS = 'https://example.com'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://example.com' }

            corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com')
        })
    })

    describe('Multiple origins', () => {
        it('should handle comma-separated origins', () => {
            process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com,https://staging.example.com'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'https://app.example.com' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(false) // Allowed
        })
    })

    describe('Development mode', () => {
        it('should allow localhost origins in development', () => {
            process.env.NODE_ENV = 'development'
            mockReq.method = 'GET'
            mockReq.headers = { origin: 'http://localhost:3000' }

            const handled = corsMiddleware(mockReq as NextApiRequest, mockRes as NextApiResponse)

            expect(handled).toBe(false) // Allowed
        })
    })
})

