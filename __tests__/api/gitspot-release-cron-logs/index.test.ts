import handler from '../../../pages/api/gitspot-release-cron-logs/index'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>

describe('/api/gitspot-release-cron-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(100)
  })

  it('should return paginated logs', async () => {
    const logs = [{ id: 1, status: 'completed', startedAt: new Date(), errors: [], mappings: [] }]
    mockPrisma.gitSpotReleaseCronLog.findMany.mockResolvedValue(logs as any)
    mockPrisma.gitSpotReleaseCronLog.count.mockResolvedValue(1 as any)

    const req = createMockRequest('GET', undefined, { limit: '50', offset: '0' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitSpotReleaseCronLog.findMany).toHaveBeenCalled()
    expect(mockPrisma.gitSpotReleaseCronLog.count).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        logs,
        total: 1,
        limit: 50,
        offset: 0,
      })
    )
  })
})

