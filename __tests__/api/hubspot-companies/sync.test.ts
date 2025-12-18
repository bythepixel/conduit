import handler from '../../../pages/api/hubspot-companies/sync'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma, mockHubSpotClient } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { getRequiredEnv } from '../../../lib/config/env'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-hubspot-token'),
}))

jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => {
    const { mockHubSpotClient } = require('../../utils/mocks')
    return mockHubSpotClient
  }),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>

describe('/api/hubspot-companies/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('POST requests', () => {
    it('should sync new companies from HubSpot', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
          { id: '456', properties: { name: 'Company 2' } },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHubSpotClient.crm.companies.basicApi.getPage).toHaveBeenCalledWith(
        100,
        undefined,
        ['name']
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 2,
          updated: 0,
          deleted: 0,
          errors: [],
        },
      })
    })

    it('should handle pagination correctly', async () => {
      const firstPage = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
        ],
        paging: {
          next: {
            after: 'next-page-token',
          },
        },
      }

      const secondPage = {
        results: [
          { id: '456', properties: { name: 'Company 2' } },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage
        .mockResolvedValueOnce(firstPage as any)
        .mockResolvedValueOnce(secondPage as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHubSpotClient.crm.companies.basicApi.getPage).toHaveBeenCalledTimes(2)
      expect(mockHubSpotClient.crm.companies.basicApi.getPage).toHaveBeenNthCalledWith(
        1,
        100,
        undefined,
        ['name']
      )
      expect(mockHubSpotClient.crm.companies.basicApi.getPage).toHaveBeenNthCalledWith(
        2,
        100,
        'next-page-token',
        ['name']
      )
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 2,
          updated: 0,
          deleted: 0,
          errors: [],
        },
      })
    })

    it('should update existing companies when names change', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: { name: 'Company Updated' } },
        ],
        paging: {},
      }

      const existingCompany = {
        id: 1,
        companyId: '123',
        name: 'Company Original',
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(existingCompany as any)
      mockPrisma.hubspotCompany.update.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Company Updated' },
      })
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 1,
          deleted: 0,
          errors: [],
        },
      })
    })

    it('should not update companies when names are unchanged', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
        ],
        paging: {},
      }

      const existingCompany = {
        id: 1,
        companyId: '123',
        name: 'Company 1',
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(existingCompany as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.update).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: [],
        },
      })
    })

    it('should handle companies without names', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: {} },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.create).toHaveBeenCalledWith({
        data: {
          companyId: '123',
          name: null,
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should skip companies without IDs', async () => {
      const mockResponse = {
        results: [
          { id: null, properties: { name: 'Invalid Company' } },
          { id: '123', properties: { name: 'Valid Company' } },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 1,
          updated: 0,
          deleted: 0,
          errors: ['Skipped company: No company ID'],
        },
      })
    })

    it('should handle duplicate company errors gracefully', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed',
      })

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: ['Skipped Company 1: Duplicate entry (companyId already exists)'],
        },
      })
    })

    it('should handle rate limit errors', async () => {
      const hubspotError = {
        code: 429,
        message: 'Rate limit exceeded',
        statusCode: 429,
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockRejectedValue(hubspotError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Rate Limit Error'),
        details: {
          code: 429,
          message: 'Rate limit exceeded',
        },
      })
    })

    it('should handle rate limit errors in catch block', async () => {
      const hubspotError = {
        statusCode: 429,
        body: {
          message: 'Too many requests',
        },
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockRejectedValue(hubspotError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Rate Limit Error'),
        details: {
          code: 429,
          message: 'Too many requests',
        },
      })
    })

    it('should handle API errors on first page', async () => {
      const hubspotError = {
        code: 500,
        message: 'Internal server error',
        statusCode: 500,
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockRejectedValue(hubspotError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'HubSpot API Error: Internal server error',
        details: {
          code: 500,
          message: 'Internal server error',
        },
      })
    })

    it('should handle API errors on subsequent pages gracefully', async () => {
      const firstPage = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
        ],
        paging: {
          next: {
            after: 'next-page-token',
          },
        },
      }

      const hubspotError = {
        code: 500,
        message: 'Internal server error',
        statusCode: 500,
      }

      mockHubSpotClient.crm.companies.basicApi.getPage
        .mockResolvedValueOnce(firstPage as any)
        .mockRejectedValueOnce(hubspotError)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)
      mockPrisma.hubspotCompany.create.mockResolvedValue({ id: 1 } as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 1,
          updated: 0,
          deleted: 0,
          errors: ['Error fetching additional pages: Internal server error'],
        },
      })
    })

    it('should handle processing errors for individual companies', async () => {
      const mockResponse = {
        results: [
          { id: '123', properties: { name: 'Company 1' } },
        ],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findUnique.mockRejectedValue(new Error('Database error'))
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: ['Error processing Company 1: Database error'],
        },
      })
    })

    it('should handle companies with empty results array', async () => {
      const mockResponse = {
        results: [],
        paging: {},
      }

      mockHubSpotClient.crm.companies.basicApi.getPage.mockResolvedValue(mockResponse as any)
      mockPrisma.hubspotCompany.findMany.mockResolvedValue([])
      mockPrisma.slackMapping.count.mockResolvedValue(0)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: [],
        },
      })
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHubSpotClient.crm.companies.basicApi.getPage).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHubSpotClient.crm.companies.basicApi.getPage).not.toHaveBeenCalled()
    })

    it('should handle general errors', async () => {
      const error = new Error('Unexpected error')
      mockHubSpotClient.crm.companies.basicApi.getPage.mockRejectedValue(error)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'HubSpot API Error: Unexpected error',
        details: {
          code: undefined,
          message: 'Unexpected error',
        },
      })
    })
  })
})

