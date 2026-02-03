import { fetchLatestReleases, syncGitHubRepositories } from '../../../lib/services/gitspot/githubService'
import { mockPrisma } from '../../utils/mocks'

jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const makeResponse = (params: {
  ok: boolean
  status?: number
  statusText?: string
  json?: any
  text?: string
}) => {
  const { ok, status = 200, statusText = 'OK', json, text } = params
  return {
    ok,
    status,
    statusText,
    json: async () => json,
    text: async () => text || '',
  } as any
}

describe('githubService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn()
    delete process.env.GITHUB_ORG
  })

  describe('syncGitHubRepositories', () => {
    it('creates new repositories when missing', async () => {
      const repo = {
        id: 100,
        full_name: 'example/repo',
        name: 'repo',
        owner: { login: 'example' },
        html_url: 'https://github.com/example/repo',
        description: 'Test repo',
        private: false,
        fork: false,
        archived: false,
        default_branch: 'main',
        pushed_at: '2024-01-01T00:00:00Z',
      }

      ;(global as any).fetch.mockResolvedValue(makeResponse({ ok: true, json: [repo] }))
      mockPrisma.gitHubRepository.findUnique.mockResolvedValue(null)

      const result = await syncGitHubRepositories()

      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
      expect(mockPrisma.gitHubRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          githubId: '100',
          fullName: 'example/repo',
          name: 'repo',
          ownerLogin: 'example',
        }),
      })
    })

    it('updates existing repositories', async () => {
      const repo = {
        id: 101,
        full_name: 'example/existing',
        name: 'existing',
        owner: { login: 'example' },
      }

      ;(global as any).fetch.mockResolvedValue(makeResponse({ ok: true, json: [repo] }))
      mockPrisma.gitHubRepository.findUnique.mockResolvedValue({ id: 10 })

      const result = await syncGitHubRepositories()

      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)
      expect(mockPrisma.gitHubRepository.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          githubId: '101',
          fullName: 'example/existing',
        }),
      })
    })

    it('skips repos missing id or full_name', async () => {
      const repo = {
        id: null,
        full_name: null,
        name: 'broken',
      }

      ;(global as any).fetch.mockResolvedValue(makeResponse({ ok: true, json: [repo] }))

      const result = await syncGitHubRepositories()

      expect(result.errors).toHaveLength(1)
      expect(mockPrisma.gitHubRepository.create).not.toHaveBeenCalled()
      expect(mockPrisma.gitHubRepository.update).not.toHaveBeenCalled()
    })

    it('throws when GitHub API responds with error', async () => {
      ;(global as any).fetch.mockResolvedValue(
        makeResponse({ ok: false, status: 500, statusText: 'Server Error', text: 'boom' })
      )

      await expect(syncGitHubRepositories()).rejects.toThrow('GitHub API Error')
    })
  })

  describe('fetchLatestReleases', () => {
    it('fetches releases for a repo', async () => {
      const releases = [{ id: 1, tag_name: 'v1.0.0' }]
      ;(global as any).fetch.mockResolvedValue(makeResponse({ ok: true, json: releases }))

      const result = await fetchLatestReleases({ owner: 'example', repo: 'repo', limit: 5 })

      expect(result).toEqual(releases)
      expect((global as any).fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/example/repo/releases?per_page=5&page=1',
        expect.any(Object)
      )
    })
  })
})
