import handler from '../../../pages/api/harvest-companies/index'
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

describe('/api/harvest-companies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('GET requests', () => {
    it('should return harvest companies', async () => {
      const mockCompanies = [
        {
          id: 1,
          harvestId: '123',
          name: 'Company 1',
          isActive: true,
          _count: {
            invoices: 5,
            mappings: 1
          }
        },
        {
          id: 2,
          harvestId: '456',
          name: 'Company 2',
          isActive: true,
          _count: {
            invoices: 3,
            mappings: 0
          }
        }
      ]

      mockPrisma.harvestCompany.findMany.mockResolvedValue(mockCompanies as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompany.findMany).toHaveBeenCalledWith({
        orderBy: [
          { name: 'asc' },
          { harvestId: 'asc' }
        ],
        include: {
          _count: {
            select: {
              invoices: true,
              mappings: true
            }
          }
        }
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockCompanies)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompany.findMany).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompany.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockPrisma.harvestCompany.findMany.mockRejectedValue(new Error('Database error'))

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})

