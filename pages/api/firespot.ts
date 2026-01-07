import type { NextApiRequest, NextApiResponse } from 'next'
import { validateMethod } from '../../lib/utils/methodValidator'
import { prisma } from '../../lib/prisma'
import { getEnv } from '../../lib/config/env'
import crypto from 'crypto'
import { FirefliesService } from '../../lib/services/fireflies/firefliesService'
import { lenientRateLimiter } from '../../lib/middleware/rateLimit'
import { corsMiddleware } from '../../lib/middleware/cors'

// Disable body parsing to get raw body for HMAC verification
export const config = {
    api: {
        bodyParser: false,
    },
}

/**
 * Reads the raw request body as a Buffer
 */
function getRawBody(req: NextApiRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
        })
        req.on('end', () => {
            resolve(Buffer.concat(chunks))
        })
        req.on('error', reject)
    })
}

/**
 * Computes HMAC SHA-256 signature of the payload
 */
function computeSignature(payload: Buffer, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    return hmac.digest('hex')
}

/**
 * Verifies the webhook signature
 */
function verifySignature(
    payload: Buffer,
    secret: string,
    receivedSignature: string | undefined
): boolean {
    if (!receivedSignature || !secret) {
        return false
    }

    try {
        // Compute expected signature
        const expectedSignature = computeSignature(payload, secret)

        // Handle different signature formats:
        // - "sha256=hexdigest" (common format)
        // - Just the hexdigest
        const receivedHash = receivedSignature.startsWith('sha256=')
            ? receivedSignature.substring(7)
            : receivedSignature

        // Validate hex format
        if (!/^[0-9a-f]+$/i.test(receivedHash)) {
            console.warn('[FireSpot] Invalid signature format (not hex)')
            return false
        }

        // Ensure both buffers are the same length for timing-safe comparison
        const expectedBuffer = Buffer.from(expectedSignature, 'hex')
        const receivedBuffer = Buffer.from(receivedHash, 'hex')

        if (expectedBuffer.length !== receivedBuffer.length) {
            return false
        }

        // Use constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    } catch (error) {
        console.error('[FireSpot] Error verifying signature:', error)
        return false
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle CORS (webhooks may come from external sources)
    if (corsMiddleware(req, res)) {
        return // CORS handled (OPTIONS request or origin blocked)
    }

    if (!validateMethod(req, res, ['POST'])) return

    // Apply rate limiting for webhook endpoint (more lenient for webhooks)
    const rateLimitResult = await lenientRateLimiter(req, res)
    if (rateLimitResult && !rateLimitResult.success) {
        return // Rate limit exceeded, response already sent
    }

    try {
        // Read raw body for HMAC verification
        const rawBody = await getRawBody(req)

        // Parse body as JSON for processing
        let body: any
        try {
            body = JSON.parse(rawBody.toString('utf8'))
        } catch (e) {
            return res.status(400).json({
                error: 'Invalid JSON in request body',
                details: 'Could not parse request body as JSON'
            })
        }

        // Log incoming request for debugging
        console.log('[FireSpot] Received POST request')
        console.log('[FireSpot] Event type:', body.eventType)
        console.log('[FireSpot] Content-Type:', req.headers['content-type'])

        const { meetingId, eventType, clientReferenceId } = body

        // Validate required field
        if (!eventType) {
            return res.status(400).json({
                error: 'eventType is required',
                received: body
            })
        }

        // Verify HMAC signature
        const webhookSecret = getEnv('FIREFLIES_WEBHOOK_SECRET', '')
        const receivedSignature = req.headers['x-hub-signature'] as string | undefined

        // Compute the signature for storage
        const computedSignature = webhookSecret ? computeSignature(rawBody, webhookSecret) : null

        // Verify the signature
        const isAuthentic = verifySignature(rawBody, webhookSecret, receivedSignature)

        console.log('[FireSpot] Signature verification:', {
            hasSecret: !!webhookSecret,
            hasSignature: !!receivedSignature,
            isAuthentic,
            computedSignature: computedSignature?.substring(0, 16) + '...',
            receivedSignature: receivedSignature?.substring(0, 16) + '...'
        })

        // Verify prisma client has the model
        if (!prisma.fireHookLog) {
            console.error('[FireSpot] Prisma client does not have fireHookLog model')
            console.error('[FireSpot] Available models:', Object.keys(prisma).filter(key => !key.startsWith('_')))
            return res.status(500).json({
                error: 'Database model not available',
                details: 'FireHookLog model not found in Prisma client. Please restart the dev server after running: npx prisma generate'
            })
        }

        // Create FireHookLog entry
        const fireHookLog = await prisma.fireHookLog.create({
            data: {
                date: new Date(),
                meetingId: meetingId || null,
                eventType: eventType,
                clientReferenceId: clientReferenceId || null,
                payload: body,
                processed: false,
                isAuthentic: isAuthentic,
                computedSignature: computedSignature,
                receivedSignature: receivedSignature || null,
            },
        })

        console.log('[FireSpot] Successfully created FireHookLog:', {
            id: fireHookLog.id,
            isAuthentic: fireHookLog.isAuthentic
        })

        // Automatically process the log if it is authentic
        if (fireHookLog.isAuthentic && fireHookLog.meetingId) {
            console.log(`[FireSpot] Triggering automatic processing for log ID: ${fireHookLog.id}`)
            try {
                const result = await FirefliesService.processFireHookLog(fireHookLog.id)
                console.log(`[FireSpot] Automatic processing completed for ID ${fireHookLog.id}:`, result)
            } catch (err) {
                console.error(`[FireSpot] Background processing failed for log ID ${fireHookLog.id}:`, err)
            }
        }

        return res.status(200).json({
            status: 'OK',
            logId: fireHookLog.id,
            isAuthentic: fireHookLog.isAuthentic
        })
    } catch (error: any) {
        console.error('[FireSpot] Error creating fire hook log:', error)
        console.error('[FireSpot] Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        })
        return res.status(500).json({
            error: 'Failed to create fire hook log',
            details: error.message,
            code: error.code
        })
    }
}

