import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { defaultRateLimiter } from '../../../lib/middleware/rateLimit'
import { handleError } from '../../../lib/utils/errorHandler'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  const rateLimitResult = await defaultRateLimiter(req, res)
  if (rateLimitResult && !rateLimitResult.success) return

  const session = await requireAuth(req, res)
  if (!session) return

  if (!validateMethod(req, res, ['GET'])) return

  try {
    const repos = await prisma.gitHubRepository.findMany({
      orderBy: { pushedAt: 'desc' },
      include: {
        _count: { select: { mappings: true } },
      },
    })
    return res.status(200).json(repos)
  } catch (e: any) {
    handleError(e, res)
  }
}

