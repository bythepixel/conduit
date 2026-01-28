import handler from '../../../pages/api/github-repositories/index'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { defaultRateLimiter } from '../../../lib/middleware/rateLimit'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/middleware/rateLimit', () => ({
  defaultRateLimiter: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockDefaultRateLimiter = defaultRateLimiter as jest.MockedFunction<typeof defaultRateLimiter>

describe('/api/github-repositories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
    mockDefaultRateLimiter.mockResolvedValue({ success: true } as any)
  })

  afterEach(async () => {
    await delayBetweenTests(100)
  })

  it('should return list of repositories', async () => {
    const repos = [
      {
        id: 1,
        githubId: '123',
        fullName: 'acme/foo',
        isPrivate: false,
        isFork: false,
        isArchived: false,
        _count: { mappings: 2 },
        pushedAt: new Date().toISOString(),
      },
    ]

    mockPrisma.gitHubRepository.findMany.mockResolvedValue(repos as any)

    const req = createMockRequest('GET')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitHubRepository.findMany).toHaveBeenCalledWith({
      orderBy: { pushedAt: 'desc' },
      include: { _count: { select: { mappings: true } } },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(repos)
  })

  it('should require authentication', async () => {
    mockRequireAuth.mockResolvedValue(null as any)

    const req = createMockRequest('GET')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitHubRepository.findMany).not.toHaveBeenCalled()
  })
})

