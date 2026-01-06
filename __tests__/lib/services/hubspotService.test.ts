import { createCompanyNote } from '../../../lib/services/hubspotService'
import { mockHubSpotClient } from '../../utils/mocks'
import { getRequiredEnv } from '../../../lib/config/env'

// Mock the config/env module
jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
}))

// Mock HubSpot Client
jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => mockHubSpotClient),
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
})





