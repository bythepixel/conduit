import { prisma } from '../../prisma'
import { getRequiredEnv } from '../../config/env'

function getGitHubRepositoryModel() {
  const model = (prisma as any).gitHubRepository
  if (!model) {
    throw new Error(
      'Prisma Client is missing model `GitHubRepository`. ' +
        'You likely updated `prisma/schema.prisma` but did not regenerate the Prisma client. ' +
        'Run: `npx prisma generate` (and apply the schema with `npx prisma db push` or `npx prisma migrate dev`), then restart the server.'
    )
  }
  return model as {
    findUnique: Function
    create: Function
    update: Function
  }
}

type GitHubRepo = {
  id: number
  full_name: string
  name: string
  owner?: { login?: string } | null
  html_url?: string | null
  description?: string | null
  private?: boolean
  fork?: boolean
  archived?: boolean
  default_branch?: string | null
  pushed_at?: string | null
}

type GitHubRelease = {
  id: number
  tag_name?: string | null
  name?: string | null
  html_url?: string | null
  body?: string | null
  draft?: boolean
  prerelease?: boolean
  published_at?: string | null
}

function getGitHubBaseHeaders(): Record<string, string> {
  const token = getRequiredEnv('GITHUB_TOKEN')
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function githubGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: getGitHubBaseHeaders(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API Error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }

  return res.json() as Promise<T>
}

async function fetchAllGitHubRepos(): Promise<GitHubRepo[]> {
  const org = process.env.GITHUB_ORG

  const repos: GitHubRepo[] = []
  const perPage = 100
  let page = 1

  // Prefer org repos if configured, otherwise fall back to the authenticated user's repos.
  while (true) {
    const url = org
      ? `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=${perPage}&page=${page}&type=all&sort=full_name&direction=asc`
      : `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&affiliation=owner,organization_member&sort=full_name&direction=asc`

    const batch = await githubGetJson<GitHubRepo[]>(url)
    if (!batch || batch.length === 0) break

    repos.push(...batch)
    if (batch.length < perPage) break
    page++
  }

  return repos
}

export async function syncGitHubRepositories(): Promise<{
  created: number
  updated: number
  errors: string[]
}> {
  const results = { created: 0, updated: 0, errors: [] as string[] }
  const repoModel = getGitHubRepositoryModel()
  const repos = await fetchAllGitHubRepos()

  for (const repo of repos) {
    try {
      const githubId = repo.id?.toString()
      const fullName = repo.full_name
      if (!githubId || !fullName) {
        results.errors.push(`Skipped repo: missing id/full_name`)
        continue
      }

      const data: any = {
        githubId,
        fullName,
        name: repo.name || null,
        ownerLogin: repo.owner?.login || null,
        htmlUrl: repo.html_url || null,
        description: repo.description || null,
        isPrivate: repo.private === true,
        isFork: repo.fork === true,
        isArchived: repo.archived === true,
        defaultBranch: repo.default_branch || null,
        pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        metadata: repo as any,
      }

      const existing = await repoModel.findUnique({ where: { githubId } })
      if (existing) {
        // Keep it simple: update fields (Prisma will no-op unchanged values).
        await repoModel.update({
          where: { id: existing.id },
          data,
        })
        results.updated++
      } else {
        await repoModel.create({ data })
        results.created++
      }
    } catch (e: any) {
      results.errors.push(`Error processing ${repo.full_name || repo.id}: ${e.message || 'Unknown error'}`)
    }
  }

  return results
}

export async function fetchLatestReleases(params: {
  owner: string
  repo: string
  limit?: number
}): Promise<GitHubRelease[]> {
  const { owner, repo, limit = 10 } = params
  const perPage = Math.min(Math.max(limit, 1), 100)
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}&page=1`
  return githubGetJson<GitHubRelease[]>(url)
}

