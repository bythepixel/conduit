import { prisma } from '../../prisma'
import { createCompanyNote } from '../hubspot/hubspotService'
import { fetchLatestReleases } from './githubService'

function getGitSpotMappingModel() {
  const model = (prisma as any).gitSpotCompanyMapping
  if (!model) {
    throw new Error(
      'Prisma Client is missing model `GitSpotCompanyMapping`. ' +
        'Run: `npx prisma generate` (and apply the schema with `npx prisma db push` or `npx prisma migrate dev`), then restart the server.'
    )
  }
  return model as {
    findMany: Function
    update: Function
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  return input.slice(0, Math.max(0, max - 3)) + '...'
}

function formatReleaseNote(params: {
  repoFullName: string
  repoUrl?: string | null
  releaseTag?: string | null
  releaseName?: string | null
  releaseUrl?: string | null
  releaseBody?: string | null
  publishedAt?: string | null
}): string {
  const {
    repoFullName,
    repoUrl,
    releaseTag,
    releaseName,
    releaseUrl,
    releaseBody,
    publishedAt,
  } = params

  const safeRepo = escapeHtml(repoFullName)
  const safeTag = escapeHtml(releaseTag || 'unknown')
  const safeName = releaseName ? escapeHtml(releaseName) : null
  const safePublished = publishedAt ? escapeHtml(publishedAt) : null
  const safeReleaseUrl = releaseUrl ? escapeHtml(releaseUrl) : null

  // HubSpot notes support HTML; keep it simple and safe.
  const body = (releaseBody || '').trim()
  const safeBody = body ? escapeHtml(truncate(body, 8000)) : ''

  const parts: string[] = []
  parts.push(`<p><strong>GitHub Release</strong></p>`)
  parts.push(
    `<p><strong>Repo:</strong> ${
      repoUrl ? `<a href="${escapeHtml(repoUrl)}">${safeRepo}</a>` : safeRepo
    }</p>`
  )
  parts.push(
    `<p><strong>Release:</strong> ${
      safeReleaseUrl ? `<a href="${safeReleaseUrl}">${safeTag}</a>` : safeTag
    }${safeName ? ` — ${safeName}` : ''}</p>`
  )
  if (safePublished) {
    parts.push(`<p><strong>Published:</strong> ${safePublished}</p>`)
  }
  if (safeBody) {
    parts.push(`<p><strong>Notes:</strong></p>`)
    parts.push(`<pre>${safeBody}</pre>`)
  }

  return parts.join('')
}

export async function syncGitSpotReleasesToHubSpot(params?: {
  mappingId?: number
  dryRun?: boolean
}): Promise<{
  mappingsProcessed: number
  notesCreated: number
  skipped: number
  errors: string[]
  mappingResults: Array<{
    mappingId: number
    status: 'success' | 'failed' | 'skipped'
    notesCreated: number
    errorMessage?: string
  }>
}> {
  const mappingId = params?.mappingId
  const dryRun = params?.dryRun === true

  const mappingModel = getGitSpotMappingModel()
  const mappings = await mappingModel.findMany({
    where: mappingId ? { id: mappingId } : undefined,
    include: {
      hubspotCompany: true,
      githubRepository: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const results = {
    mappingsProcessed: 0,
    notesCreated: 0,
    skipped: 0,
    errors: [] as string[],
    mappingResults: [] as Array<{
      mappingId: number
      status: 'success' | 'failed' | 'skipped'
      notesCreated: number
      errorMessage?: string
    }>,
  }

  for (const mapping of mappings) {
    results.mappingsProcessed++

    try {
      const companyId = mapping.hubspotCompany.companyId
      const repo = mapping.githubRepository

      const owner = repo.ownerLogin
      const repoName = repo.name

      if (!companyId) {
        const msg = `Mapping ${mapping.id}: HubSpot company missing companyId`
        results.errors.push(msg)
        results.mappingResults.push({ mappingId: mapping.id, status: 'failed', notesCreated: 0, errorMessage: msg })
        continue
      }

      if (!owner || !repoName) {
        const msg = `Mapping ${mapping.id}: GitHub repo missing owner/name (${repo.fullName || repo.githubId})`
        results.errors.push(msg)
        results.mappingResults.push({ mappingId: mapping.id, status: 'failed', notesCreated: 0, errorMessage: msg })
        continue
      }

      const releases = await fetchLatestReleases({ owner, repo: repoName, limit: 10 })
      const publishable = (releases || []).filter(
        r => r && r.draft !== true && r.published_at
      )

      if (publishable.length === 0) {
        results.skipped++
        results.mappingResults.push({ mappingId: mapping.id, status: 'skipped', notesCreated: 0 })
        continue
      }

      // Sort ascending by published_at, so we can post multiple new releases in order.
      const sorted = publishable
        .slice()
        .sort((a, b) => new Date(a.published_at as string).getTime() - new Date(b.published_at as string).getTime())

      const lastPublishedAt = mapping.lastReleasePublishedAt
        ? mapping.lastReleasePublishedAt.getTime()
        : null
      const lastReleaseId = mapping.lastReleaseId ? Number(mapping.lastReleaseId) : null

      const newReleases = sorted.filter(r => {
        const publishedAtMs = r.published_at ? new Date(r.published_at).getTime() : null
        const isAfterTime = lastPublishedAt === null ? true : (publishedAtMs !== null && publishedAtMs > lastPublishedAt)
        const isAfterId = lastReleaseId === null ? true : (typeof r.id === 'number' && r.id > lastReleaseId)
        // Prefer timestamp cursor when we have it; fall back to ID comparison.
        return lastPublishedAt !== null ? isAfterTime : isAfterId
      })

      if (newReleases.length === 0) {
        results.skipped++
        results.mappingResults.push({ mappingId: mapping.id, status: 'skipped', notesCreated: 0 })
        continue
      }

      // Post each new release as a note (oldest → newest).
      let mappingNotesCreated = 0
      for (const rel of newReleases) {
        const noteBody = formatReleaseNote({
          repoFullName: repo.fullName,
          repoUrl: repo.htmlUrl,
          releaseTag: rel.tag_name || null,
          releaseName: rel.name || null,
          releaseUrl: rel.html_url || null,
          releaseBody: rel.body || null,
          publishedAt: rel.published_at || null,
        })

        if (!dryRun) {
          await createCompanyNote(companyId, noteBody)
        }
        results.notesCreated++
        mappingNotesCreated++

        // small delay to reduce HubSpot rate-limit risk
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const newest = newReleases[newReleases.length - 1]
      if (!dryRun) {
        await mappingModel.update({
          where: { id: mapping.id },
          data: {
            lastReleaseId: newest.id?.toString() || mapping.lastReleaseId || null,
            lastReleaseTagName: newest.tag_name || mapping.lastReleaseTagName || null,
            lastReleasePublishedAt: newest.published_at ? new Date(newest.published_at) : mapping.lastReleasePublishedAt || null,
          },
        })
      }

      results.mappingResults.push({ mappingId: mapping.id, status: 'success', notesCreated: mappingNotesCreated })
    } catch (e: any) {
      const msg = `Mapping ${mapping.id}: ${e.message || 'Unknown error'}`
      results.errors.push(msg)
      results.mappingResults.push({ mappingId: mapping.id, status: 'failed', notesCreated: 0, errorMessage: msg })
    }
  }

  return results
}

