import handler from '../../../pages/api/slack-mappings/index'
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

describe('/api/slack-mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  describe('GET', () => {
    it('should return list of mappings', async () => {
      const mockMappings = [
        {
          id: 1,
          title: 'Test Mapping',
          slackChannels: [],
          hubspotCompany: { id: 1, companyId: 'company-1', name: 'Company 1' },
          createdAt: new Date(),
        },
      ]

      mockPrisma.slackMapping.findMany.mockResolvedValue(mockMappings as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: expect.objectContaining({
          slackChannels: expect.any(Object),
          hubspotCompany: true,
        }),
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockMappings)
    })
  })

  describe('POST', () => {
    it('should create a mapping with multiple channels', async () => {
      const mockCompany = { id: 1, companyId: 'company-123', name: 'Test Company' }
      const mockChannels = [
        { id: 1, channelId: 'C123', name: 'Channel 1' },
        { id: 2, channelId: 'C456', name: 'Channel 2' },
      ]

      const createdMapping = {
        id: 1,
        title: 'Test Mapping',
        hubspotCompanyId: 1,
        cadence: 'daily',
        slackChannels: [
          { slackChannel: mockChannels[0] },
          { slackChannel: mockChannels[1] },
        ],
        hubspotCompany: mockCompany,
      }

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockCompany as any)
      mockPrisma.slackChannel.findMany.mockResolvedValue(mockChannels as any)
      mockPrisma.slackMapping.create.mockResolvedValue(createdMapping as any)

      const req = createMockRequest('POST', {
        channelIds: [1, 2],
        companyId: 'company-123',
        title: 'Test Mapping',
        cadence: 'daily',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Test Mapping',
            hubspotCompanyId: 1,
            cadence: 'daily',
            slackChannels: {
              create: [
                { slackChannelId: 1 },
                { slackChannelId: 2 },
              ],
            },
          }),
        })
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(createdMapping)
    })

    it('should return 400 when channelIds is missing', async () => {
      const req = createMockRequest('POST', {
        companyId: 'company-123',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'At least one channelId is required',
      })
    })

    it('should return 400 when channelIds is empty array', async () => {
      const req = createMockRequest('POST', {
        channelIds: [],
        companyId: 'company-123',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'At least one channelId is required',
      })
    })

    it('should return 400 when companyId is missing', async () => {
      const req = createMockRequest('POST', {
        channelIds: [1],
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'companyId is required',
      })
    })

    it('should return 400 when company is not found', async () => {
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(null)

      const req = createMockRequest('POST', {
        channelIds: [1],
        companyId: 'non-existent',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company not found. Please create it first.',
      })
    })

    it('should return 400 when channels are not found', async () => {
      const mockCompany = { id: 1, companyId: 'company-123' }
      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockCompany as any)
      mockPrisma.slackChannel.findMany.mockResolvedValue([{ id: 1 }] as any)

      const req = createMockRequest('POST', {
        channelIds: [1, 2],
        companyId: 'company-123',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'One or more channels not found',
      })
    })

    it('should use default cadence when invalid cadence provided', async () => {
      const mockCompany = { id: 1, companyId: 'company-123' }
      const mockChannels = [{ id: 1 }]

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockCompany as any)
      mockPrisma.slackChannel.findMany.mockResolvedValue(mockChannels as any)
      mockPrisma.slackMapping.create.mockResolvedValue({
        id: 1,
        cadence: 'daily',
      } as any)

      const req = createMockRequest('POST', {
        channelIds: [1],
        companyId: 'company-123',
        cadence: 'invalid',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cadence: 'daily',
          }),
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockCompany = { id: 1, companyId: 'company-123' }
      const mockChannels = [{ id: 1 }]

      mockPrisma.hubspotCompany.findUnique.mockResolvedValue(mockCompany as any)
      mockPrisma.slackChannel.findMany.mockResolvedValue(mockChannels as any)

      const error = new Error('Creation failed')
      mockPrisma.slackMapping.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        channelIds: [1],
        companyId: 'company-123',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })
})




