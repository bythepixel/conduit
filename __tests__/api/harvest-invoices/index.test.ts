import handler from '../../../pages/api/harvest-invoices/index'
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

describe('/api/harvest-invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('GET requests', () => {
    it('should return invoices with mapping status', async () => {
      const mockInvoices = [
        {
          id: 1,
          harvestId: '123',
          clientId: 'client-1',
          clientName: 'Client 1',
          amount: 1000,
          state: 'open',
          hasMapping: true,
          harvestCompany: {
            mappings: [{ id: 1 }]
          }
        },
        {
          id: 2,
          harvestId: '456',
          clientId: 'client-2',
          clientName: 'Client 2',
          amount: 2000,
          state: 'paid',
          hasMapping: false,
          harvestCompany: null
        }
      ]

      mockPrisma.harvestInvoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.harvestInvoice.count.mockResolvedValue(2 as any)
      mockPrisma.harvestCompany.findMany.mockResolvedValue([])

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findMany).toHaveBeenCalledWith({
        where: undefined,
        take: 100,
        skip: 0,
        include: {
          harvestCompany: {
            include: {
              mappings: {
                select: {
                  id: true
                }
              }
            }
          }
        },
        orderBy: [
          { issueDate: 'desc' },
          { createdAt: 'desc' }
        ]
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          invoices: expect.any(Array),
          total: 2,
          limit: 100,
          offset: 0
        })
      )
    })

    it('should handle invoices without harvestCompany relation', async () => {
      const mockInvoices = [
        {
          id: 1,
          harvestId: '123',
          clientId: 'client-1',
          harvestCompany: null
        }
      ]

      const mockHarvestCompanies = [
        {
          harvestId: 'client-1',
          mappings: []
        }
      ]

      mockPrisma.harvestInvoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.harvestInvoice.count.mockResolvedValue(1 as any)
      mockPrisma.harvestCompany.findMany.mockResolvedValue(mockHarvestCompanies as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findMany).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestInvoice.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockPrisma.harvestInvoice.findMany.mockRejectedValue(new Error('Database error'))

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})

