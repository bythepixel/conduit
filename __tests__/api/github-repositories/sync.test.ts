import handler from '../../../pages/api/github-repositories/sync'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { syncGitHubRepositories } from '../../../lib/services/gitspot/githubService'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/services/gitspot/githubService', () => ({
  syncGitHubRepositories: jest.fn(),
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockSyncGitHubRepositories = syncGitHubRepositories as jest.MockedFunction<typeof syncGitHubRepositories>

describe('/api/github-repositories/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(100)
  })

  it('should sync repositories and return results', async () => {
    mockSyncGitHubRepositories.mockResolvedValue({ created: 1, updated: 2, errors: [] })

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSyncGitHubRepositories).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Sync completed',
      results: { created: 1, updated: 2, errors: [] },
    })
  })

  it('should handle errors', async () => {
    mockSyncGitHubRepositories.mockRejectedValue(new Error('boom'))

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'boom' })
  })
})

