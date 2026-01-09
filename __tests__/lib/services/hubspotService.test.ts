import { createCompanyNote, createDealFromHarvestInvoice, syncDealFromHarvestInvoice } from '../../../lib/services/hubspot/hubspotService'
import { mockHubSpotClient, mockPrisma } from '../../utils/mocks'
import { getRequiredEnv, getEnv } from '../../../lib/config/env'

// Mock the config/env module
jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
  getEnv: jest.fn((key: string, defaultValue?: string) => defaultValue || 'default-value'),
}))

// Mock HubSpot Client
jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => mockHubSpotClient),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

describe('hubspotService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Date.now() for consistent timestamp testing
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createCompanyNote', () => {
    it('should create a note successfully', async () => {
      mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({
        id: 'note-123',
      })

      await createCompanyNote('company-123', 'Test note content')

      expect(mockHubSpotClient.crm.objects.notes.basicApi.create).toHaveBeenCalledWith({
        properties: {
          hs_timestamp: '1234567890000',
          hs_note_body: 'Test note content',
        },
        associations: [
          {
            to: { id: 'company-123' },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 190,
              },
            ],
          },
        ],
      })
    })

    it('should handle rate limit errors (429 status)', async () => {
      const rateLimitError = {
        code: 429,
        message: 'Too many requests',
        statusCode: 429,
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        rateLimitError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Rate Limit Error'
      )
    })

    it('should handle rate limit errors in message', async () => {
      const rateLimitError = {
        message: 'rate limit exceeded',
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        rateLimitError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Rate Limit Error'
      )
    })

    it('should handle "too many requests" in message', async () => {
      const rateLimitError = {
        message: 'too many requests',
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        rateLimitError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Rate Limit Error'
      )
    })

    it('should handle rate limit errors with statusCode', async () => {
      const rateLimitError = {
        statusCode: 429,
        message: 'Rate limit',
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        rateLimitError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Rate Limit Error'
      )
    })

    it('should handle rate limit errors with status', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit',
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        rateLimitError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Rate Limit Error'
      )
    })

    it('should handle general API errors', async () => {
      const apiError = {
        code: 400,
        message: 'Invalid request',
        body: { message: 'Bad request' },
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        apiError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Error'
      )
    })

    it('should handle errors with body.message', async () => {
      const apiError = {
        body: { message: 'Custom error message' },
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        apiError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Error: Custom error message'
      )
    })

    it('should handle errors with unknown format', async () => {
      const unknownError = {
        message: 'Unknown error',
      }

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        unknownError
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Error: Unknown error'
      )
    })

    it('should handle errors without message', async () => {
      const errorWithoutMessage = {}

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(
        errorWithoutMessage
      )

      await expect(createCompanyNote('company-123', 'Test note')).rejects.toThrow(
        'HubSpot API Error: Unknown error'
      )
    })

    it('should use current timestamp for note', async () => {
      const timestamp = 9876543210000
      jest.spyOn(Date, 'now').mockReturnValue(timestamp)

      mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({
        id: 'note-123',
      })

      await createCompanyNote('company-123', 'Test note')

      expect(mockHubSpotClient.crm.objects.notes.basicApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_timestamp: timestamp.toString(),
          }),
        })
      )
    })
  })

  describe('createDealFromHarvestInvoice', () => {
    beforeEach(() => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue({
        id: 1,
        harvestId: '123',
        state: 'open',
        subject: 'Test Invoice',
        amount: 1000,
        currency: 'USD',
        issueDate: new Date('2024-01-01'),
        paidDate: null,
        harvestCompanyId: 1,
        hubspotDealId: null
      } as any)

      mockPrisma.harvestCompany.findUnique.mockResolvedValue({
        id: 1,
        harvestId: 'client-123',
        mappings: [{
          hubspotCompany: {
            id: 1,
            companyId: 'hs-123',
            ownerId: 'owner-123'
          }
        }]
      } as any)

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue({
        id: 1,
        companyId: 'hs-123',
        ownerId: 'owner-123'
      } as any)

      mockHubSpotClient.crm.deals.basicApi.create.mockResolvedValue({
        id: 'deal-123'
      } as any)

      mockPrisma.harvestInvoice.update.mockResolvedValue({} as any)
    })

    it('should create a deal from an invoice', async () => {
      const result = await createDealFromHarvestInvoice(1)

      expect(mockPrisma.harvestInvoice.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      })
      expect(mockHubSpotClient.crm.deals.basicApi.create).toHaveBeenCalled()
      expect(mockPrisma.harvestInvoice.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { hubspotDealId: 'deal-123' }
      })
      expect(result).toEqual({
        dealId: 'deal-123',
        companyId: 'hs-123'
      })
    })

    it('should throw error if invoice not found', async () => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue(null)

      await expect(createDealFromHarvestInvoice(999)).rejects.toThrow('Invoice with ID 999 not found')
    })

    it('should throw error for draft invoices', async () => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue({
        id: 1,
        state: 'draft'
      } as any)

      await expect(createDealFromHarvestInvoice(1)).rejects.toThrow('Draft state')
    })

    it('should throw error if no company mapping exists', async () => {
      mockPrisma.harvestCompany.findUnique.mockResolvedValue({
        id: 1,
        harvestId: 'client-123',
        mappings: []
      } as any)

      await expect(createDealFromHarvestInvoice(1)).rejects.toThrow('mapped to any HubSpot company')
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError: any = new Error('Rate limit')
      rateLimitError.code = 429
      rateLimitError.statusCode = 429

      mockHubSpotClient.crm.deals.basicApi.create.mockRejectedValue(rateLimitError)

      await expect(createDealFromHarvestInvoice(1)).rejects.toThrow('Rate Limit Error')
    })
  })

  describe('syncDealFromHarvestInvoice', () => {
    beforeEach(() => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue({
        id: 1,
        harvestId: '123',
        state: 'open',
        hubspotDealId: 'deal-123',
        subject: 'Test Invoice',
        amount: 1000,
        currency: 'USD',
        issueDate: new Date('2024-01-01'),
        paidDate: null,
        harvestCompanyId: 1
      } as any)

      mockPrisma.harvestCompany.findUnique.mockResolvedValue({
        id: 1,
        harvestId: 'client-123',
        mappings: [{
          hubspotCompany: {
            id: 1,
            companyId: 'hs-123',
            ownerId: 'owner-123'
          }
        }]
      } as any)

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue({
        id: 1,
        companyId: 'hs-123',
        ownerId: 'owner-123'
      } as any)

      mockHubSpotClient.crm.deals.basicApi.update.mockResolvedValue({} as any)
    })

    it('should sync a deal from an invoice', async () => {
      const result = await syncDealFromHarvestInvoice(1)

      expect(mockPrisma.harvestInvoice.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      })
      expect(mockHubSpotClient.crm.deals.basicApi.update).toHaveBeenCalledWith(
        'deal-123',
        expect.any(Object)
      )
      expect(result).toEqual({
        dealId: 'deal-123',
        companyId: 'hs-123'
      })
    })

    it('should throw error if invoice has no deal ID', async () => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue({
        id: 1,
        hubspotDealId: null
      } as any)

      await expect(syncDealFromHarvestInvoice(1)).rejects.toThrow('does not have an associated HubSpot deal')
    })

    it('should throw error for draft invoices', async () => {
      mockPrisma.harvestInvoice.findUnique.mockResolvedValue({
        id: 1,
        hubspotDealId: 'deal-123',
        state: 'draft'
      } as any)

      await expect(syncDealFromHarvestInvoice(1)).rejects.toThrow('Draft state')
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError: any = new Error('Rate limit')
      rateLimitError.code = 429
      rateLimitError.statusCode = 429

      mockHubSpotClient.crm.deals.basicApi.update.mockRejectedValue(rateLimitError)

      await expect(syncDealFromHarvestInvoice(1)).rejects.toThrow('Rate Limit Error')
    })
  })
})







