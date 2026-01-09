import handler from '../../../pages/api/harvest-companies/sync'
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

// Mock fetch globally
global.fetch = jest.fn()

describe('/api/harvest-companies/sync', () => {
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
    it('should sync companies from Harvest API', async () => {
      const mockHarvestResponse = {
        clients: [
          {
            id: 123,
            name: 'Test Client',
            is_active: true
          }
        ],
        total_pages: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      mockPrisma.harvestCompany.findUnique.mockResolvedValue(null)
      mockPrisma.harvestCompany.create.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.harvestapp.com/v2/clients'),
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

    it('should update existing companies', async () => {
      const mockHarvestResponse = {
        clients: [
          {
            id: 123,
            name: 'Updated Client Name',
            is_active: true
          }
        ],
        total_pages: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockHarvestResponse
      })

      const existingCompany = {
        id: 1,
        harvestId: '123',
        name: 'Old Name'
      }

      mockPrisma.harvestCompany.findUnique.mockResolvedValue(existingCompany as any)
      mockPrisma.harvestCompany.update.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompany.update).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})

