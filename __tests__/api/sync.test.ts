import handler from '../../pages/api/sync'
import { createMockRequest, createMockResponse } from '../utils/testHelpers'
import { mockPrisma } from '../utils/mocks'
import { fetchRecentMessages } from '../../lib/services/slack/slackService'
import { createCompanyNote } from '../../lib/services/hubspot/hubspotService'
import { generateSummary, generateFallbackSummary } from '../../lib/services/ai/openaiService'
import { getUserMap, formatMessagesForSummary } from '../../lib/services/slack/userMappingService'
import { getCadencesForToday } from '../../lib/services/core/cadenceService'

// Mock all services
jest.mock('../../lib/services/slack/slackService')
jest.mock('../../lib/services/hubspot/hubspotService')
jest.mock('../../lib/services/ai/openaiService')
jest.mock('../../lib/services/slack/userMappingService')
jest.mock('../../lib/services/core/cadenceService')
jest.mock('../../lib/prisma', () => ({
  prisma: require('../utils/mocks').mockPrisma,
}))

const mockFetchRecentMessages = fetchRecentMessages as jest.MockedFunction<typeof fetchRecentMessages>
const mockCreateCompanyNote = createCompanyNote as jest.MockedFunction<typeof createCompanyNote>
const mockGenerateSummary = generateSummary as jest.MockedFunction<typeof generateSummary>
const mockGenerateFallbackSummary = generateFallbackSummary as jest.MockedFunction<typeof generateFallbackSummary>
const mockGetUserMap = getUserMap as jest.MockedFunction<typeof getUserMap>
const mockFormatMessagesForSummary = formatMessagesForSummary as jest.MockedFunction<typeof formatMessagesForSummary>
const mockGetCadencesForToday = getCadencesForToday as jest.MockedFunction<typeof getCadencesForToday>

describe('/api/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    // Mock cron log operations
    mockPrisma.cronLog = {
      create: jest.fn(),
      update: jest.fn(),
    } as any
    mockPrisma.cronLogMapping = {
      create: jest.fn(),
    } as any
  })

  afterEach(async () => {
    delete process.env.CRON_SECRET
    // Add delay to prevent rate limiting between tests
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  describe('POST requests', () => {
    it('should sync a specific mapping when mappingId is provided', async () => {
      const mockMapping = {
        id: 1,
        slackChannels: [
          {
            slackChannel: {
              channelId: 'C123',
              name: 'test-channel',
            },
          },
        ],
        hubspotCompany: {
          companyId: 'company-123',
          name: 'Test Company',
        },
      }

      const mockHistory = {
        messages: [
          { user: 'U123', text: 'Hello' },
          { user: 'U456', text: 'World' },
        ],
      }

      const mockUserMap = new Map([['U123', 'John Doe']])
      const mockMessagesText = 'John Doe: Hello\nUser456: World'
      const mockSummary = 'Test summary'

      mockPrisma.slackMapping.findMany.mockResolvedValue([mockMapping] as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      mockFetchRecentMessages.mockResolvedValue(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockResolvedValue(mockSummary)
      mockPrisma.slackMapping.update.mockResolvedValue({} as any)

      const req = createMockRequest('POST', { mappingId: 1 })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Sync process completed',
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              channelId: 'C123',
              status: 'Synced',
              summary: mockSummary,
            }),
          ]),
        })
      )
    })

    it('should sync all mappings when no mappingId is provided', async () => {
      const mockMappings = [
        {
          id: 1,
          slackChannels: [
            {
              slackChannel: {
                channelId: 'C123',
                name: 'channel-1',
              },
            },
          ],
          hubspotCompany: {
            companyId: 'company-1',
            name: 'Company 1',
          },
        },
        {
          id: 2,
          slackChannels: [
            {
              slackChannel: {
                channelId: 'C456',
                name: 'channel-2',
              },
            },
          ],
          hubspotCompany: {
            companyId: 'company-2',
            name: 'Company 2',
          },
        },
      ]

      const mockHistory = { messages: [{ user: 'U123', text: 'Test' }] }
      const mockUserMap = new Map()
      const mockMessagesText = 'Test messages'
      const mockSummary = 'Summary'

      mockPrisma.slackMapping.findMany.mockResolvedValue(mockMappings as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      mockFetchRecentMessages.mockResolvedValue(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockResolvedValue(mockSummary)
      mockPrisma.slackMapping.update.mockResolvedValue({} as any)

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackMapping.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
      })
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle test mode', async () => {
      const mockMapping = {
        id: 1,
        slackChannels: [
          {
            slackChannel: {
              channelId: 'C123',
              name: 'test-channel',
            },
          },
        ],
        hubspotCompany: {
          companyId: 'company-123',
          name: 'Test Company',
        },
      }

      const mockHistory = { messages: [{ user: 'U123', text: 'Test' }] }
      const mockUserMap = new Map()
      const mockMessagesText = 'Test messages'
      const mockSummary = 'Test summary'

      mockPrisma.slackMapping.findMany.mockResolvedValue([mockMapping] as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      mockFetchRecentMessages.mockResolvedValue(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockResolvedValue(mockSummary)

      const req = createMockRequest('POST', { test: true })
      const res = createMockResponse()

      await handler(req as any, res)

      // Should not create HubSpot note or update mapping in test mode
      expect(mockCreateCompanyNote).not.toHaveBeenCalled()
      expect(mockPrisma.slackMapping.update).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              status: 'Test Complete',
            }),
          ]),
        })
      )
    })

    it('should handle mappings with no messages', async () => {
      const mockMapping = {
        id: 1,
        slackChannels: [
          {
            slackChannel: {
              channelId: 'C123',
              name: 'test-channel',
            },
          },
        ],
        hubspotCompany: {
          companyId: 'company-123',
          name: 'Test Company',
        },
      }

      mockPrisma.slackMapping.findMany.mockResolvedValue([mockMapping] as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(new Map())
      mockFetchRecentMessages.mockResolvedValue({ messages: [] } as any)

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              status: 'No messages to sync',
            }),
          ]),
        })
      )
    })

    it('should handle OpenAI errors with fallback', async () => {
      const mockMapping = {
        id: 1,
        slackChannels: [
          {
            slackChannel: {
              channelId: 'C123',
              name: 'test-channel',
            },
          },
        ],
        hubspotCompany: {
          companyId: 'company-123',
          name: 'Test Company',
        },
      }

      const mockHistory = { messages: [{ user: 'U123', text: 'Test' }] }
      const mockUserMap = new Map()
      const mockMessagesText = 'Test messages'
      const mockFallbackSummary = 'Fallback summary'

      mockPrisma.slackMapping.findMany.mockResolvedValue([mockMapping] as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      mockFetchRecentMessages.mockResolvedValue(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockRejectedValue(new Error('OpenAI error'))
      mockGenerateFallbackSummary.mockReturnValue(mockFallbackSummary)
      mockPrisma.slackMapping.update.mockResolvedValue({} as any)

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockGenerateFallbackSummary).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              summary: mockFallbackSummary,
            }),
          ]),
        })
      )
    })

    it('should handle errors during sync and continue processing', async () => {
      const mockMappings = [
        {
          id: 1,
          slackChannels: [
            {
              slackChannel: {
                channelId: 'C123',
                name: 'channel-1',
              },
            },
          ],
          hubspotCompany: {
            companyId: 'company-1',
            name: 'Company 1',
          },
        },
        {
          id: 2,
          slackChannels: [
            {
              slackChannel: {
                channelId: 'C456',
                name: 'channel-2',
              },
            },
          ],
          hubspotCompany: {
            companyId: 'company-2',
            name: 'Company 2',
          },
        },
      ]

      const mockHistory = { messages: [{ user: 'U123', text: 'Test' }] }
      const mockUserMap = new Map()
      const mockMessagesText = 'Test messages'

      mockPrisma.slackMapping.findMany.mockResolvedValue(mockMappings as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      // First channel fails, second succeeds
      mockFetchRecentMessages
        .mockRejectedValueOnce(new Error('Slack API error'))
        .mockResolvedValueOnce(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockResolvedValue('Summary')
      mockPrisma.slackMapping.update.mockResolvedValue({} as any)

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              status: 'Failed',
              error: 'Slack API error',
            }),
            expect.objectContaining({
              status: 'Synced',
            }),
          ]),
        })
      )
    })

    it('should use active prompt when available', async () => {
      const mockMapping = {
        id: 1,
        slackChannels: [
          {
            slackChannel: {
              channelId: 'C123',
              name: 'test-channel',
            },
          },
        ],
        hubspotCompany: {
          companyId: 'company-123',
          name: 'Test Company',
        },
      }

      const mockPrompt = {
        id: 1,
        content: 'Custom prompt',
        isActive: true,
      }

      const mockHistory = { messages: [{ user: 'U123', text: 'Test' }] }
      const mockUserMap = new Map()
      const mockMessagesText = 'Test messages'
      const mockSummary = 'Summary'

      mockPrisma.slackMapping.findMany.mockResolvedValue([mockMapping] as any)
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt as any)
      mockGetUserMap.mockResolvedValue(mockUserMap)
      mockFetchRecentMessages.mockResolvedValue(mockHistory as any)
      mockFormatMessagesForSummary.mockReturnValue(mockMessagesText)
      mockGenerateSummary.mockResolvedValue(mockSummary)
      mockPrisma.slackMapping.update.mockResolvedValue({} as any)

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        mockMessagesText,
        'Custom prompt',
        '#test-channel'
      )
    })
  })

  describe('GET requests (Cron)', () => {
    beforeEach(() => {
      // Mock cron log creation for cron calls
      mockPrisma.cronLog.create.mockResolvedValue({
        id: 1,
        status: 'running',
        mappingsFound: 0,
        mappingsExecuted: 0,
        mappingsFailed: 0,
      } as any)
      mockPrisma.cronLog.update.mockResolvedValue({} as any)
    })

    it('should require CRON_SECRET authorization', async () => {
      process.env.CRON_SECRET = 'test-secret'

      const req = createMockRequest('GET', {}, {}, { authorization: 'Bearer wrong-secret' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })

    it('should allow GET without CRON_SECRET when env var not set', async () => {
      delete process.env.CRON_SECRET

      mockGetCadencesForToday.mockReturnValue({
        shouldSync: false,
        cadences: [],
        dayOfWeek: 0,
        dayOfMonth: 1,
        lastDayOfMonth: 31,
      })

      const req = createMockRequest('GET', {}, {}, {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should filter by cadence on weekdays', async () => {
      process.env.CRON_SECRET = 'test-secret'

      mockGetCadencesForToday.mockReturnValue({
        shouldSync: true,
        cadences: ['daily'],
        dayOfWeek: 1,
        dayOfMonth: 15,
        lastDayOfMonth: 31,
      })

      mockPrisma.cronLog.create.mockResolvedValue({
        id: 1,
        status: 'running',
        mappingsFound: 0,
        mappingsExecuted: 0,
        mappingsFailed: 0,
      } as any)
      mockPrisma.slackMapping.findMany.mockResolvedValue([])
      mockPrisma.prompt.findFirst.mockResolvedValue(null)
      mockGetUserMap.mockResolvedValue(new Map())
      mockPrisma.cronLog.update.mockResolvedValue({} as any)

      const req = createMockRequest('GET', {}, {}, { authorization: 'Bearer test-secret' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.cronLog.create).toHaveBeenCalled()
      expect(mockPrisma.slackMapping.findMany).toHaveBeenCalledWith({
        where: { cadence: { in: ['daily'] } },
        include: expect.any(Object),
      })
    })

    it('should return early when no mappings should sync', async () => {
      process.env.CRON_SECRET = 'test-secret'

      mockGetCadencesForToday.mockReturnValue({
        shouldSync: false,
        cadences: [],
        dayOfWeek: 0, // Sunday
        dayOfMonth: 1,
        lastDayOfMonth: 31,
      })

      mockPrisma.cronLog.create.mockResolvedValue({
        id: 1,
        status: 'running',
        mappingsFound: 0,
        mappingsExecuted: 0,
        mappingsFailed: 0,
      } as any)
      mockPrisma.cronLog.update.mockResolvedValue({} as any)

      const req = createMockRequest('GET', {}, {}, { authorization: 'Bearer test-secret' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.cronLog.create).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No mappings scheduled for sync today',
          results: [],
        })
      )
      expect(mockPrisma.slackMapping.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.cronLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'completed',
          }),
        })
      )
    })
  })

  describe('Method validation', () => {
    it('should reject unsupported methods', async () => {
      const req = createMockRequest('PUT', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET', 'POST'])
      expect(res.status).toHaveBeenCalledWith(405)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.slackMapping.findMany.mockRejectedValue(new Error('Database error'))

      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' })
    })
  })
})

