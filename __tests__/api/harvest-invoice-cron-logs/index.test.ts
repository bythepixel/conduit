import handler from '../../../pages/api/harvest-invoice-cron-logs/index'
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

describe('/api/harvest-invoice-cron-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('GET requests', () => {
    it('should return cron logs with pagination', async () => {
      const mockLogs = [
        {
          id: 1,
          status: 'completed',
          invoicesFound: 10,
          invoicesCreated: 5,
          invoicesUpdated: 5,
          startedAt: new Date(),
          completedAt: new Date()
        }
      ]

      mockPrisma.harvestInvoiceCronLog.findMany.mockResolvedValue(mockLogs as any)
      mockPrisma.harvestInvoiceCronLog.count.mockResolvedValue(1)

      const req = createMockRequest('GET', undefined, { limit: '50', offset: '0' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoiceCronLog.findMany).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      })
    })

    it('should use default pagination values', async () => {
      mockPrisma.harvestInvoiceCronLog.findMany.mockResolvedValue([])
      mockPrisma.harvestInvoiceCronLog.count.mockResolvedValue(0)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoiceCronLog.findMany).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoiceCronLog.findMany).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoiceCronLog.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockPrisma.harvestInvoiceCronLog.findMany.mockRejectedValue(new Error('Database error'))

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})

