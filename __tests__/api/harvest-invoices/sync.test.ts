import handler from '../../../pages/api/harvest-invoices/sync'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma, mockHubSpotClient } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { createDealFromHarvestInvoice } from '../../../lib/services/hubspot/hubspotService'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

jest.mock('../../../lib/services/hubspot/hubspotService', () => ({
  createDealFromHarvestInvoice: jest.fn(),
}))

jest.mock('../../../lib/services/harvest/harvestCronLogService', () => ({
  createHarvestInvoiceCronLog: jest.fn(() => Promise.resolve(1)),
  updateHarvestInvoiceCronLogInvoicesFound: jest.fn(),
  finalizeHarvestInvoiceCronLog: jest.fn(),
  updateHarvestInvoiceCronLogFailed: jest.fn(),
  createHarvestInvoiceErrorCronLog: jest.fn(),
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockCreateDeal = createDealFromHarvestInvoice as jest.MockedFunction<typeof createDealFromHarvestInvoice>

// Mock fetch globally
global.fetch = jest.fn()

describe('/api/harvest-invoices/sync', () => {
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
    it('should sync invoices from Harvest API', async () => {
      const mockHarvestResponse = {
        invoices: [
          {
            id: 123,
            client: { id: 456, name: 'Test Client' },
            number: 'INV-001',
            amount: '1000.00',
            state: 'open',
            issue_date: '2024-01-01',
            due_date: '2024-01-31',
            paid_date: null,
            currency: 'USD',
            subject: 'Test Invoice'
          }
        ],
        total_pages: 1,
        total_entries: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      mockPrisma.harvestCompany.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.create.mockResolvedValue({ id: 1, hubspotDealId: null, state: 'open' } as any)
      mockCreateDeal.mockRejectedValue(new Error('No company mapping'))

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.harvestapp.com/v2/invoices'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Harvest-Account-ID': 'test-account-id'
          })
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle missing Harvest credentials', async () => {
      delete process.env.HARVEST_ACCOUNT_ID

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Harvest API credentials not configured'
        })
      )
    })

    it('should handle rate limit errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      })

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(429)
    })

    it('should automatically create deals for eligible invoices', async () => {
      const mockHarvestResponse = {
        invoices: [
          {
            id: 123,
            client: { id: 456, name: 'Test Client' },
            amount: '1000.00',
            state: 'open',
            issue_date: '2024-01-01'
          }
        ],
        total_pages: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      const mockHarvestCompany = { id: 1, harvestId: '456' }
      mockPrisma.harvestCompany.findUnique.mockResolvedValue(mockHarvestCompany as any)
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.create.mockResolvedValue({ 
        id: 1, 
        hubspotDealId: null, 
        state: 'open',
        harvestCompanyId: 1
      } as any)
      mockCreateDeal.mockResolvedValue({ dealId: 'deal-123', companyId: 'company-123' })

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockCreateDeal).toHaveBeenCalledWith(1)
    })

    it('should not create deals for draft invoices', async () => {
      const mockHarvestResponse = {
        invoices: [
          {
            id: 123,
            client: { id: 456 },
            state: 'draft',
            amount: '1000.00'
          }
        ],
        total_pages: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      mockPrisma.harvestCompany.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(null)
      mockPrisma.harvestInvoice.create.mockResolvedValue({ 
        id: 1, 
        state: 'draft' 
      } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockCreateDeal).not.toHaveBeenCalled()
    })

    it('should require authentication for POST requests', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('GET requests (cron)', () => {
    it('should handle cron job execution', async () => {
      const mockHarvestResponse = {
        invoices: [],
        total_pages: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      const req = createMockRequest('GET', undefined, undefined, {
        'x-vercel-cron': '1'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should validate CRON_SECRET for manual cron calls', async () => {
      process.env.CRON_SECRET = 'test-secret'
      const req = createMockRequest('GET', undefined, undefined, {
        authorization: 'Bearer wrong-secret'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })
  })
})

