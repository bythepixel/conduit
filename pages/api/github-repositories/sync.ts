import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { syncGitHubRepositories } from '../../../lib/services/gitspot/githubService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res)
  if (!session) return

  if (!validateMethod(req, res, ['POST'])) return

  try {
    const results = await syncGitHubRepositories()
    return res.status(200).json({ message: 'Sync completed', results })
  } catch (e: any) {
    console.error('Error syncing GitHub repositories:', e)
    return res.status(500).json({ error: e.message || 'Failed to sync GitHub repositories' })
  }
}

