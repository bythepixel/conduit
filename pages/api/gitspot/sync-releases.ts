import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/middleware/auth'
import { syncGitSpotReleasesToHubSpot } from '../../../lib/services/gitspot/gitspotReleaseSyncService'
import {
  createGitSpotReleaseCronLog,
  updateGitSpotReleaseCronLogMappingsFound,
  createGitSpotReleaseCronLogMapping,
  finalizeGitSpotReleaseCronLog,
  failGitSpotReleaseCronLog,
} from '../../../lib/services/gitspot/gitspotCronLogService'

// Force dynamic execution to prevent caching issues with Vercel cron jobs
export const dynamic = 'force-dynamic'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle Vercel Cron (GET)
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isCronCall = req.method === 'GET'
  let cronLogId: number | null = null

  if (req.method === 'GET') {
    // If CRON_SECRET is set, verify it matches (unless it's a Vercel cron)
    if (process.env.CRON_SECRET && !isVercelCron) {
      const authHeader = req.headers.authorization || ''
      const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
      if (authHeader !== expectedAuth) {
        console.error('[GITSPOT CRON] Unauthorized: Missing or invalid CRON_SECRET')
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }
  } else if (req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { mappingId, dryRun } = (req.body || {}) as { mappingId?: number; dryRun?: boolean }
    if (isCronCall) {
      cronLogId = await createGitSpotReleaseCronLog()
    }

    const results = await syncGitSpotReleasesToHubSpot({
      mappingId: mappingId ? Number(mappingId) : undefined,
      dryRun: dryRun === true,
    })

    if (isCronCall && cronLogId) {
      await updateGitSpotReleaseCronLogMappingsFound(cronLogId, results.mappingsProcessed)

      for (const mr of results.mappingResults) {
        await createGitSpotReleaseCronLogMapping({
          cronLogId,
          mappingId: mr.mappingId,
          status: mr.status,
          notesCreated: mr.notesCreated,
          errorMessage: mr.errorMessage,
        })
      }

      const mappingsFailed = results.mappingResults.filter(m => m.status === 'failed').length
      const mappingsSkipped = results.mappingResults.filter(m => m.status === 'skipped').length
      const mappingsExecuted = results.mappingResults.filter(m => m.status === 'success').length

      await finalizeGitSpotReleaseCronLog({
        cronLogId,
        mappingsExecuted,
        mappingsFailed,
        mappingsSkipped,
        notesCreated: results.notesCreated,
        errors: results.errors,
      })
    }

    return res.status(200).json({ message: 'GitSpot release sync completed', cronLogId, results })
  } catch (e: any) {
    console.error('[GITSPOT] Release sync error:', e)
    if (isCronCall && cronLogId) {
      await failGitSpotReleaseCronLog(cronLogId, e.message || 'Failed to sync GitSpot releases')
    }
    return res.status(500).json({ error: e.message || 'Failed to sync GitSpot releases' })
  }
}

