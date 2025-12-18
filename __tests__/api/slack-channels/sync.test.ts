import handler from '../../../pages/api/slack-channels/sync'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma, mockSlackClient } from '../../utils/mocks'
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
  getRequiredEnv: jest.fn(() => 'test-slack-token'),
}))

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => {
    const { mockSlackClient } = require('../../utils/mocks')
    return mockSlackClient
  }),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>

describe('/api/slack-channels/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(150)
  })

  describe('POST requests', () => {
    it('should sync new channels from Slack', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: 'general' },
          { id: 'C456', name: 'random' },
        ],
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(null)
      mockPrisma.slackChannel.create.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSlackClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel,private_channel',
        exclude_archived: true,
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 2,
          updated: 0,
          errors: [],
        },
      })
    })

    it('should update existing channels when names change', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: 'general-updated' },
        ],
      }

      const existingChannel = {
        id: 1,
        channelId: 'C123',
        name: 'general',
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(existingChannel as any)
      mockPrisma.slackChannel.update.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'general-updated' },
      })
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 1,
          errors: [],
        },
      })
    })

    it('should not update channels when names are unchanged', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: 'general' },
        ],
      }

      const existingChannel = {
        id: 1,
        channelId: 'C123',
        name: 'general',
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(existingChannel as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.update).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          errors: [],
        },
      })
    })

    it('should handle channels without names', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: null },
        ],
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(null)
      mockPrisma.slackChannel.create.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.create).toHaveBeenCalledWith({
        data: {
          channelId: 'C123',
          name: null,
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should skip channels without IDs', async () => {
      const mockChannels = {
        channels: [
          { id: null, name: 'invalid-channel' },
          { id: 'C123', name: 'valid-channel' },
        ],
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(null)
      mockPrisma.slackChannel.create.mockResolvedValue({ id: 1 } as any)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 1,
          updated: 0,
          errors: ['Skipped channel: No channel ID'],
        },
      })
    })

    it('should handle duplicate channel errors gracefully', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: 'general' },
        ],
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockResolvedValue(null)
      mockPrisma.slackChannel.create.mockRejectedValue({
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
          errors: ['Skipped general: Duplicate entry (channelId already exists)'],
        },
      })
    })

    it('should handle missing scope error', async () => {
      const slackError = {
        data: {
          error: 'missing_scope',
          needed: ['channels:read', 'groups:read'],
          provided: ['chat:write'],
        },
      }

      mockSlackClient.conversations.list.mockRejectedValue(slackError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Missing scopes'),
        details: {
          needed: ['channels:read', 'groups:read'],
          provided: ['chat:write'],
          instructions: expect.stringContaining('OAuth & Permissions'),
        },
      })
    })

    it('should handle missing scope error with single scope string', async () => {
      const slackError = {
        data: {
          error: 'missing_scope',
          needed: 'channels:read',
          provided: 'chat:write',
        },
      }

      mockSlackClient.conversations.list.mockRejectedValue(slackError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Missing scopes'),
        details: {
          needed: ['channels:read'],
          provided: ['chat:write'],
          instructions: expect.stringContaining('OAuth & Permissions'),
        },
      })
    })

    it('should handle missing scope error without scope details', async () => {
      const slackError = {
        data: {
          error: 'missing_scope',
        },
      }

      mockSlackClient.conversations.list.mockRejectedValue(slackError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('channels:read'),
        details: {
          needed: ['channels:read', 'groups:read'],
          provided: [],
          instructions: expect.stringContaining('OAuth & Permissions'),
        },
      })
    })

    it('should handle other Slack API errors', async () => {
      const slackError = {
        code: 'slack_error',
        message: 'API call failed',
      }

      mockSlackClient.conversations.list.mockRejectedValue(slackError)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'API call failed',
      })
    })

    it('should handle processing errors for individual channels', async () => {
      const mockChannels = {
        channels: [
          { id: 'C123', name: 'general' },
        ],
      }

      mockSlackClient.conversations.list.mockResolvedValue(mockChannels as any)
      mockPrisma.slackChannel.findUnique.mockRejectedValue(new Error('Database error'))

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith({
        message: 'Sync completed',
        results: {
          created: 0,
          updated: 0,
          errors: ['Error processing general: Database error'],
        },
      })
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockResolvedValue(null)

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSlackClient.conversations.list).not.toHaveBeenCalled()
    })

    it('should validate HTTP method', async () => {
      mockValidateMethod.mockReturnValue(false)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockSlackClient.conversations.list).not.toHaveBeenCalled()
    })
  })
})


