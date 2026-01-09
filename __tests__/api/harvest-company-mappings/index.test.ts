import handler from '../../../pages/api/harvest-company-mappings/index'
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

describe('/api/harvest-company-mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('GET requests', () => {
    it('should return all mappings', async () => {
      const mockMappings = [
        {
          id: 1,
          hubspotCompanyId: 1,
          harvestCompanyId: 1,
          hubspotCompany: { id: 1, name: 'HubSpot Co' },
          harvestCompany: { id: 1, name: 'Harvest Co' }
        }
      ]

      mockPrisma.harvestCompanyMapping.findMany.mockResolvedValue(mockMappings as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompanyMapping.findMany).toHaveBeenCalledWith({
        include: {
          hubspotCompany: true,
          harvestCompany: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockMappings)
    })
  })

  describe('POST requests', () => {
    it('should create a new mapping', async () => {
      const mockHubspotCompany = { id: 1, companyId: 'hs-123' }
      const mockHarvestCompany = { id: 1, harvestId: 'hv-123' }

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockHubspotCompany as any)
      mockPrisma.harvestCompany.findUnique.mockResolvedValue(mockHarvestCompany as any)
      mockPrisma.harvestCompanyMapping.findUnique.mockResolvedValue(null)
      mockPrisma.harvestCompanyMapping.create.mockResolvedValue({
        id: 1,
        hubspotCompanyId: 1,
        harvestCompanyId: 1
      } as any)

      const req = createMockRequest('POST', {
        hubspotCompanyId: 1,
        harvestCompanyId: 1
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompanyMapping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            hubspotCompanyId: 1,
            harvestCompanyId: 1
          }
        })
      )
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should return 400 if hubspotCompanyId is missing', async () => {
      const req = createMockRequest('POST', {
        harvestCompanyId: 1
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'hubspotCompanyId and harvestCompanyId are required'
      })
    })

    it('should return 404 if HubSpot company not found', async () => {
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)

      const req = createMockRequest('POST', {
        hubspotCompanyId: 999,
        harvestCompanyId: 1
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'HubSpot company not found'
      })
    })

    it('should return 404 if Harvest company not found', async () => {
      const mockHubspotCompany = { id: 1 }
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockHubspotCompany as any)
      mockPrisma.harvestCompany.findUnique.mockResolvedValue(null)

      const req = createMockRequest('POST', {
        hubspotCompanyId: 1,
        harvestCompanyId: 999
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Harvest company not found'
      })
    })

    it('should handle duplicate mapping errors', async () => {
      const mockHubspotCompany = { id: 1 }
      const mockHarvestCompany = { id: 1 }

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockHubspotCompany as any)
      mockPrisma.harvestCompany.findUnique.mockResolvedValue(mockHarvestCompany as any)
      mockPrisma.harvestCompanyMapping.findUnique.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST', {
        hubspotCompanyId: 1,
        harvestCompanyId: 1
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Mapping already exists'
      })
    })
  })

  describe('DELETE requests', () => {
    it('should delete a mapping', async () => {
      mockPrisma.harvestCompanyMapping.delete.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('DELETE', undefined, { 
        hubspotCompanyId: '1', 
        harvestCompanyId: '1' 
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.harvestCompanyMapping.delete).toHaveBeenCalledWith({
        where: {
          hubspotCompanyId_harvestCompanyId: {
            hubspotCompanyId: 1,
            harvestCompanyId: 1
          }
        }
      })
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should return 400 if parameters are missing', async () => {
      const req = createMockRequest('DELETE', undefined, { hubspotCompanyId: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 404 if mapping not found', async () => {
      const error: any = new Error('Not found')
      error.code = 'P2025'
      mockPrisma.harvestCompanyMapping.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', undefined, { 
        hubspotCompanyId: '999', 
        harvestCompanyId: '999' 
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Mapping not found'
      })
    })
  })
})

