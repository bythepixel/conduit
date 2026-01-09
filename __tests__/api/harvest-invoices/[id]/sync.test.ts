import handler from '../../../../pages/api/harvest-invoices/[id]/sync'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../../utils/testHelpers'
import { mockPrisma } from '../../../utils/mocks'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'

jest.mock('../../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../../lib/prisma', () => ({
  prisma: require('../../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>

// Mock fetch globally
global.fetch = jest.fn()

describe('/api/harvest-invoices/[id]/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
    process.env.HARVEST_ACCOUNT_ID = 'test-account-id'
    process.env.HARVEST_ACCESS_TOKEN = 'test-access-token'
  })

  afterEach(async () => {
    await delayBetweenTests(150)
    delete process.env.HARVEST_ACCOUNT_ID
    delete process.env.HARVEST_ACCESS_TOKEN
  })

  describe('POST requests', () => {
    it('should sync a single invoice from Harvest', async () => {
      const mockInvoice = {
        id: 1,
        harvestId: '123',
        clientId: 'client-1'
      }

      const mockHarvestResponse = {
        id: 123,
        client: { id: 456, name: 'Test Client' },
        number: 'INV-001',
        amount: '1000.00',
        state: 'open'
      }

      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })
      mockPrisma.harvestCompany.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.update.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.harvestapp.com/v2/invoices/123'),
        expect.any(Object)
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should return 404 if invoice not found', async () => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(null)

      const req = createMockRequest('POST', undefined, { id: '999' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findUnique).toHaveBeenCalledWith({
        where: { id: 999 }
      })
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invoice not found'
      })
    })

    it('should handle missing Harvest credentials', async () => {
      delete process.env.HARVEST_ACCOUNT_ID

      const mockInvoice = { id: 1, harvestId: '123' }
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should handle Harvest API errors', async () => {
      const mockInvoice = { id: 1, harvestId: '123' }
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(mockInvoice as any)

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not found'
      })

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findUnique).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('GET', undefined, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findUnique).not.toHaveBeenCalled()
    })
  })
})

