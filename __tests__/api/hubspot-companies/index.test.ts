import handler from '../../../pages/api/hubspot-companies/index'
import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { getServerSession } from 'next-auth/next'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../pages/api/auth/[...nextauth]', () => ({
  authOptions: {},
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('/api/hubspot-companies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  describe('GET', () => {
    it('should return list of companies', async () => {
      const mockCompanies = [
        {
          id: 1,
          companyId: 'company-1',
          name: 'Company 1',
          _count: { mappings: 2 },
          createdAt: new Date(),
        },
        {
          id: 2,
          companyId: 'company-2',
          name: 'Company 2',
          _count: { mappings: 0 },
          createdAt: new Date(),
        },
      ]

      mockPrisma.hubspotCompany.findMany.mockResolvedValue(mockCompanies as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { mappings: true },
          },
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockCompanies)
    })
  })

  describe('POST', () => {
    it('should create a company', async () => {
      const newCompany = {
        id: 1,
        companyId: 'company-123',
        name: 'New Company',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.hubspotCompany.create.mockResolvedValue(newCompany as any)

      const req = createMockRequest('POST', {
        companyId: 'company-123',
        name: 'New Company',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-123',
          name: 'New Company',
        },
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(newCompany)
    })

    it('should return 400 when companyId is missing', async () => {
      const req = createMockRequest('POST', {
        name: 'Company without ID',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'companyId is required',
      })
    })

    it('should handle duplicate companyId error', async () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed',
      }

      mockPrisma.hubspotCompany.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        companyId: 'company-123',
        name: 'Duplicate Company',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company ID already exists',
      })
    })

    it('should handle general creation errors', async () => {
      const error = {
        message: 'Creation failed',
      }

      mockPrisma.hubspotCompany.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        companyId: 'company-123',
        name: 'Test Company',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Creation failed',
      })
    })
  })
})



