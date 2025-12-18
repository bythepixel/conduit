import handler from '../../../pages/api/slack-channels/index'
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

describe('/api/slack-channels', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  describe('GET', () => {
    it('should return list of channels', async () => {
      const mockChannels = [
        {
          id: 1,
          channelId: 'C123',
          name: 'Channel 1',
          _count: { mappings: 2 },
          createdAt: new Date(),
        },
        {
          id: 2,
          channelId: 'C456',
          name: 'Channel 2',
          _count: { mappings: 0 },
          createdAt: new Date(),
        },
      ]

      mockPrisma.slackChannel.findMany.mockResolvedValue(mockChannels as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { mappings: true },
          },
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockChannels)
    })
  })

  describe('POST', () => {
    it('should create a channel', async () => {
      const newChannel = {
        id: 1,
        channelId: 'C123',
        name: 'New Channel',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.slackChannel.create.mockResolvedValue(newChannel as any)

      const req = createMockRequest('POST', {
        channelId: 'C123',
        name: 'New Channel',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.create).toHaveBeenCalledWith({
        data: {
          channelId: 'C123',
          name: 'New Channel',
        },
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(newChannel)
    })

    it('should return 400 when channelId is missing', async () => {
      const req = createMockRequest('POST', {
        name: 'Channel without ID',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'channelId is required',
      })
    })

    it('should handle duplicate channelId error', async () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed',
      }

      mockPrisma.slackChannel.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        channelId: 'C123',
        name: 'Duplicate Channel',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Channel ID already exists',
      })
    })

    it('should handle general creation errors', async () => {
      const error = {
        message: 'Creation failed',
      }

      mockPrisma.slackChannel.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        channelId: 'C123',
        name: 'Test Channel',
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


