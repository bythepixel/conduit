import handler from '../../../../pages/api/harvest-invoices/[id]/sync-deal'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../../utils/testHelpers'
import { mockPrisma } from '../../../utils/mocks'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { syncDealFromHarvestInvoice } from '../../../../lib/services/hubspot/hubspotService'

jest.mock('../../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../../lib/prisma', () => ({
  prisma: require('../../../utils/mocks').mockPrisma,
}))

jest.mock('../../../../lib/services/hubspot/hubspotService', () => ({
  syncDealFromHarvestInvoice: jest.fn(),
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockSyncDeal = syncDealFromHarvestInvoice as jest.MockedFunction<typeof syncDealFromHarvestInvoice>

describe('/api/harvest-invoices/[id]/sync-deal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('POST requests', () => {
    it('should sync a deal from an invoice', async () => {
      const mockInvoice = {
        id: 1,
        harvestId: '123',
        hubspotDealId: 'deal-123',
        state: 'open'
      }

      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)
      mockSyncDeal.mockResolvedValue({
        dealId: 'deal-123',
        companyId: 'company-123'
      })

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSyncDeal).toHaveBeenCalledWith(1)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          dealId: 'deal-123',
          companyId: 'company-123'
        })
      )
    })

    it('should handle invoice not found error', async () => {
      mockSyncDeal.mockRejectedValue(new Error('Invoice with ID 999 not found'))

      const req = createMockRequest('POST', undefined, { id: '999' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSyncDeal).toHaveBeenCalledWith(999)
      expect(res.status).toHaveBeenCalledWith(500)
    })

    it('should handle deal sync errors', async () => {
      const mockInvoice = {
        id: 1,
        harvestId: '123',
        hubspotDealId: 'deal-123',
        state: 'open'
      }

      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)
      mockSyncDeal.mockRejectedValue(new Error('Sync failed'))

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })

    it('should handle rate limit errors', async () => {
      const mockInvoice = {
        id: 1,
        harvestId: '123',
        hubspotDealId: 'deal-123',
        state: 'open'
      }

      const rateLimitError: any = new Error('Rate limit')
      rateLimitError.code = 429
      rateLimitError.statusCode = 429

      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)
      mockSyncDeal.mockRejectedValue(rateLimitError)

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(429)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSyncDeal).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('GET', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSyncDeal).not.toHaveBeenCalled()
    })
  })
})

