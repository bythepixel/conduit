import type { NextApiRequest, NextApiResponse } from 'next'
import { validateMethod } from '../../lib/utils/methodValidator'
import { prisma } from '../../lib/prisma'

// Disable body parsing for this route - we'll handle it manually if needed
export const config = {
    api: {
        bodyParser: true,
    },
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (!validateMethod(req, res, ['POST'])) return

    try {
        // Log incoming request for debugging
        console.log('[FireSpot] Received POST request')
        console.log('[FireSpot] Request body:', JSON.stringify(req.body, null, 2))
        console.log('[FireSpot] Content-Type:', req.headers['content-type'])

        // Ensure body is parsed
        let body = req.body
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body)
            } catch (e) {
                return res.status(400).json({ 
                    error: 'Invalid JSON in request body',
                    details: 'Could not parse request body as JSON'
                })
            }
        }

        const { meetingId, eventType, clientReferenceId } = body

        // Validate required field
        if (!eventType) {
            return res.status(400).json({ 
                error: 'eventType is required',
                received: body
            })
        }

        // Prepare payload - ensure it's a valid JSON object
        const payload = body && typeof body === 'object' ? body : null

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
                payload: payload,
                processed: false,
            },
        })

        console.log('[FireSpot] Successfully created FireHookLog:', fireHookLog.id)

        return res.status(200).json({ 
            status: 'OK',
            logId: fireHookLog.id
        })
    } catch (error: any) {
        console.error('[FireSpot] Error creating fire hook log:', error)
        console.error('[FireSpot] Request body:', req.body)
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

