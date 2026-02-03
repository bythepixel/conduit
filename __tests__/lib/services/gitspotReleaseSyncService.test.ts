import { syncGitSpotReleasesToHubSpot } from '../../../lib/services/gitspot/gitspotReleaseSyncService'
import { mockPrisma } from '../../utils/mocks'

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

jest.mock('../../../lib/services/hubspot/hubspotService', () => ({
  createCompanyNote: jest.fn(),
}))

jest.mock('../../../lib/services/gitspot/githubService', () => ({
  fetchLatestReleases: jest.fn(),
}))

const { createCompanyNote } = require('../../../lib/services/hubspot/hubspotService')
const { fetchLatestReleases } = require('../../../lib/services/gitspot/githubService')

describe('gitspotReleaseSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails when HubSpot companyId is missing', async () => {
    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue([
      {
        id: 1,
        hubspotCompany: { companyId: null },
        githubRepository: { ownerLogin: 'example', name: 'repo', fullName: 'example/repo' },
      },
    ])

    const result = await syncGitSpotReleasesToHubSpot()

    expect(result.errors).toHaveLength(1)
    expect(result.mappingResults[0].status).toBe('failed')
    expect(createCompanyNote).not.toHaveBeenCalled()
  })

  it('fails when repo owner/name is missing', async () => {
    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue([
      {
        id: 2,
        hubspotCompany: { companyId: 'hs-123' },
        githubRepository: { ownerLogin: null, name: null, fullName: 'example/repo' },
      },
    ])

    const result = await syncGitSpotReleasesToHubSpot()

    expect(result.errors).toHaveLength(1)
    expect(result.mappingResults[0].status).toBe('failed')
    expect(fetchLatestReleases).not.toHaveBeenCalled()
  })

  it('skips when no publishable releases exist', async () => {
    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue([
      {
        id: 3,
        hubspotCompany: { companyId: 'hs-123' },
        githubRepository: { ownerLogin: 'example', name: 'repo', fullName: 'example/repo' },
      },
    ])
    fetchLatestReleases.mockResolvedValue([{ id: 1, draft: true, published_at: null }])

    const result = await syncGitSpotReleasesToHubSpot()

    expect(result.skipped).toBe(1)
    expect(result.mappingResults[0].status).toBe('skipped')
    expect(createCompanyNote).not.toHaveBeenCalled()
  })

  it('creates notes for new releases and updates mapping', async () => {
    const publishedAt = '2024-02-01T00:00:00Z'
    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue([
      {
        id: 4,
        lastReleasePublishedAt: new Date('2024-01-01T00:00:00Z'),
        lastReleaseId: '10',
        lastReleaseTagName: 'v0.9.0',
        hubspotCompany: { companyId: 'hs-123' },
        githubRepository: {
          ownerLogin: 'example',
          name: 'repo',
          fullName: 'example/repo',
          htmlUrl: 'https://github.com/example/repo',
        },
      },
    ])
    fetchLatestReleases.mockResolvedValue([
      {
        id: 11,
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        html_url: 'https://github.com/example/repo/releases/v1.0.0',
        body: 'Notes',
        draft: false,
        published_at: publishedAt,
      },
    ])
    createCompanyNote.mockResolvedValue(undefined)

    const result = await syncGitSpotReleasesToHubSpot()

    expect(result.notesCreated).toBe(1)
    expect(result.mappingResults[0].status).toBe('success')
    expect(createCompanyNote).toHaveBeenCalledWith(
      'hs-123',
      expect.stringContaining('GitHub Release')
    )
    expect(mockPrisma.gitSpotCompanyMapping.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        lastReleaseId: '11',
        lastReleaseTagName: 'v1.0.0',
        lastReleasePublishedAt: new Date(publishedAt),
      },
    })
  })

  it('respects dryRun and does not create notes or update mapping', async () => {
    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue([
      {
        id: 5,
        hubspotCompany: { companyId: 'hs-123' },
        githubRepository: { ownerLogin: 'example', name: 'repo', fullName: 'example/repo' },
      },
    ])
    fetchLatestReleases.mockResolvedValue([
      { id: 1, tag_name: 'v1.0.0', published_at: '2024-02-01T00:00:00Z', draft: false },
    ])

    const result = await syncGitSpotReleasesToHubSpot({ dryRun: true })

    expect(result.notesCreated).toBe(1)
    expect(createCompanyNote).not.toHaveBeenCalled()
    expect(mockPrisma.gitSpotCompanyMapping.update).not.toHaveBeenCalled()
  })
})
