import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'
import { defaultRateLimiter } from '../../../lib/middleware/rateLimit'
import { corsMiddleware } from '../../../lib/middleware/cors'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS
  if (corsMiddleware(req, res)) return

  // Apply rate limiting
  const rateLimitResult = await defaultRateLimiter(req, res)
  if (rateLimitResult && !rateLimitResult.success) return

  const session = await requireAuth(req, res)
  if (!session) return

  if (!validateMethod(req, res, ['GET', 'POST', 'DELETE'])) return

  if (req.method === 'GET') {
    try {
      const mappings = await prisma.gitSpotCompanyMapping.findMany({
        include: {
          hubspotCompany: true,
          githubRepository: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return res.status(200).json(mappings)
    } catch (e: any) {
      return handleError(e, res)
    }
  }

  if (req.method === 'POST') {
    try {
      const { hubspotCompanyId, githubRepositoryId, githubRepositoryIds } = req.body

      const repoIdsInput =
        Array.isArray(githubRepositoryIds) ? githubRepositoryIds : (githubRepositoryId ? [githubRepositoryId] : [])

      if (!hubspotCompanyId || repoIdsInput.length === 0) {
        return res.status(400).json({ error: 'hubspotCompanyId and githubRepositoryId(s) are required' })
      }

      const hubspotId = parseInt(hubspotCompanyId, 10)
      const repoIds = repoIdsInput.map((id: any) => parseInt(id, 10)).filter((n: number) => Number.isFinite(n))
      if (repoIds.length === 0) {
        return res.status(400).json({ error: 'No valid githubRepositoryId(s) provided' })
      }

      const hubspotCompany = await prisma.hubspotCompany.findUnique({ where: { id: hubspotId } })
      if (!hubspotCompany) return res.status(404).json({ error: 'HubSpot company not found' })

      const results = { created: 0, skipped: 0, errors: [] as string[] }

      for (const repoId of repoIds) {
        try {
          const existing = await prisma.gitSpotCompanyMapping.findUnique({
            where: {
              hubspotCompanyId_githubRepositoryId: {
                hubspotCompanyId: hubspotId,
                githubRepositoryId: repoId,
              },
            },
          })

          if (existing) {
            results.skipped++
            continue
          }

          const githubRepository = await prisma.gitHubRepository.findUnique({ where: { id: repoId } })
          if (!githubRepository) {
            results.errors.push(`GitHub repository not found (id=${repoId})`)
            continue
          }

          await prisma.gitSpotCompanyMapping.create({
            data: {
              hubspotCompanyId: hubspotId,
              githubRepositoryId: repoId,
            },
          })
          results.created++
        } catch (e: any) {
          results.errors.push(`Error creating mapping for repoId=${repoId}: ${e.message || 'Unknown error'}`)
        }
      }

      return res.status(201).json({ message: 'Mappings created', results })
    } catch (e: any) {
      return handleError(e, res)
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { hubspotCompanyId, githubRepositoryId } = req.query

      if (!hubspotCompanyId || !githubRepositoryId) {
        return res.status(400).json({ error: 'hubspotCompanyId and githubRepositoryId are required' })
      }

      await prisma.gitSpotCompanyMapping.delete({
        where: {
          hubspotCompanyId_githubRepositoryId: {
            hubspotCompanyId: parseInt(hubspotCompanyId as string, 10),
            githubRepositoryId: parseInt(githubRepositoryId as string, 10),
          },
        },
      })

      return res.status(200).json({ message: 'Mapping deleted successfully' })
    } catch (e: any) {
      if (e.code === 'P2025') {
        return res.status(404).json({ error: 'Mapping not found' })
      }
      return handleError(e, res)
    }
  }
}

