import handler from '../../../pages/api/slack-mappings/[id]'
import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { handleError } from '../../../lib/utils/errorHandler'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/utils/errorHandler', () => ({
  handleError: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockHandleError = handleError as jest.MockedFunction<typeof handleError>

describe('/api/slack-mappings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  describe('DELETE', () => {
    it('should delete a mapping', async () => {
      mockPrisma.slackMapping.delete.mockResolvedValue({} as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('should handle deletion errors', async () => {
      const error = new Error('Deletion failed')
      mockPrisma.slackMapping.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })

  describe('PUT', () => {
    it('should update a mapping', async () => {
      const existingMapping = {
        id: 1,
        hubspotCompanyId: 1,
        slackChannels: [
          { slackChannel: { id: 1 } },
        ],
        hubspotCompany: { id: 1, companyId: 'company-1' },
      }

      const updatedMapping = {
        id: 1,
        title: 'Updated Mapping',
        hubspotCompanyId: 1,
        cadence: 'weekly',
        slackChannels: [
          { slackChannel: { id: 2 } },
        ],
        hubspotCompany: { id: 1, companyId: 'company-1', name: 'Company 1' },
      }

      mockPrisma.slackMapping.findUnique.mockResolvedValue(existingMapping as any)
      mockPrisma.slackMapping.update.mockResolvedValue(updatedMapping as any)

      const req = createMockRequest('PUT', {
        channelIds: [2],
        companyId: 1,
        title: 'Updated Mapping',
        cadence: 'weekly',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            title: 'Updated Mapping',
            cadence: 'weekly',
            slackChannels: {
              deleteMany: {},
              create: [{ slackChannelId: 2 }],
            },
          }),
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(updatedMapping)
    })

    it('should return 404 when mapping not found', async () => {
      mockPrisma.slackMapping.findUnique.mockResolvedValue(null)

      const req = createMockRequest('PUT', {
        channelIds: [1],
        companyId: 1,
      }, { id: '999' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Mapping not found',
      })
    })

    it('should update company when companyId changes', async () => {
      const existingMapping = {
        id: 1,
        hubspotCompanyId: 1,
        slackChannels: [],
        hubspotCompany: { id: 1 },
      }

      const newCompany = { id: 2, companyId: 'company-2' }

      mockPrisma.slackMapping.findUnique.mockResolvedValue(existingMapping as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(newCompany as any)
      mockPrisma.slackMapping.update.mockResolvedValue({
        id: 1,
        hubspotCompanyId: 2,
      } as any)

      const req = createMockRequest('PUT', {
        channelIds: [],
        companyId: 2,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hubspotCompanyId: 2,
          }),
        })
      )
    })

    it('should return 400 when new company not found', async () => {
      const existingMapping = {
        id: 1,
        hubspotCompanyId: 1,
        slackChannels: [],
        hubspotCompany: { id: 1 },
      }

      mockPrisma.slackMapping.findUnique.mockResolvedValue(existingMapping as any)
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)

      const req = createMockRequest('PUT', {
        channelIds: [],
        companyId: 999,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company not found',
      })
    })

    it('should handle empty channelIds array', async () => {
      const existingMapping = {
        id: 1,
        hubspotCompanyId: 1,
        slackChannels: [],
        hubspotCompany: { id: 1 },
      }

      mockPrisma.slackMapping.findUnique.mockResolvedValue(existingMapping as any)
      mockPrisma.slackMapping.update.mockResolvedValue({
        id: 1,
        slackChannels: [],
      } as any)

      const req = createMockRequest('PUT', {
        channelIds: [],
        companyId: 1,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slackChannels: {
              deleteMany: {},
              create: [],
            },
          }),
        })
      )
    })

    it('should handle update errors', async () => {
      const existingMapping = {
        id: 1,
        hubspotCompanyId: 1,
        slackChannels: [],
        hubspotCompany: { id: 1 },
      }

      mockPrisma.slackMapping.findUnique.mockResolvedValue(existingMapping as any)

      const error = new Error('Update failed')
      mockPrisma.slackMapping.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        channelIds: [1],
        companyId: 1,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })
})


