import handler from '../../../pages/api/gitspot/sync-releases'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { requireAuth } from '../../../lib/middleware/auth'
import { syncGitSpotReleasesToHubSpot } from '../../../lib/services/gitspot/gitspotReleaseSyncService'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/services/gitspot/gitspotReleaseSyncService', () => ({
  syncGitSpotReleasesToHubSpot: jest.fn(),
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockSync = syncGitSpotReleasesToHubSpot as jest.MockedFunction<typeof syncGitSpotReleasesToHubSpot>

describe('/api/gitspot/sync-releases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
  })

  afterEach(async () => {
    await delayBetweenTests(100)
    delete process.env.CRON_SECRET
  })

  it('POST should sync releases (manual)', async () => {
    mockSync.mockResolvedValue({
      mappingsProcessed: 1,
      notesCreated: 2,
      skipped: 0,
      errors: [],
      mappingResults: [],
    } as any)

    const req = createMockRequest('POST', {})
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSync).toHaveBeenCalledWith({ mappingId: undefined, dryRun: false })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      message: 'GitSpot release sync completed',
      cronLogId: null,
      results: { mappingsProcessed: 1, notesCreated: 2, skipped: 0, errors: [], mappingResults: [] },
    })
  })

  it('GET should require CRON_SECRET when configured', async () => {
    process.env.CRON_SECRET = 'secret'

    const req = createMockRequest('GET', undefined, undefined, {})
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })
})

