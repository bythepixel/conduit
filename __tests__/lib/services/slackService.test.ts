import { fetchChannelHistory, fetchRecentMessages } from '../../../lib/services/slackService'
import { mockSlackClient } from '../../utils/mocks'
import { getRequiredEnv } from '../../../lib/config/env'

// Mock the config/env module
jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
}))

// Mock Slack WebClient
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => mockSlackClient),
}))

describe('slackService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchChannelHistory', () => {
    it('should fetch conversation history successfully', async () => {
      const mockHistory = {
        messages: [
          { user: 'U123', text: 'Hello' },
          { user: 'U456', text: 'World' },
        ],
      }

      mockSlackClient.conversations.history.mockResolvedValue(mockHistory)

      const result = await fetchChannelHistory('C123456')

      expect(result).toEqual(mockHistory)
      expect(mockSlackClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C123456',
      })
    })

    it('should include oldest timestamp when provided', async () => {
      const mockHistory = { messages: [] }
      const timestamp = Date.now() - 86400000 // 1 day ago
      
      mockSlackClient.conversations.history.mockResolvedValue(mockHistory)

      await fetchChannelHistory('C123456', timestamp)

      expect(mockSlackClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C123456',
        oldest: (timestamp / 1000).toString(),
      })
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        data: { error: 'rate_limited' },
        status: 429,
        message: 'Rate limit exceeded',
      }

      mockSlackClient.conversations.history.mockRejectedValue(rateLimitError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Rate Limit Error'
      )
    })

    it('should handle rate limit errors with status 429', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Too many requests',
      }

      mockSlackClient.conversations.history.mockRejectedValue(rateLimitError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Rate Limit Error'
      )
    })

    it('should handle rate limit errors in error message', async () => {
      const rateLimitError = {
        message: 'rate limit exceeded',
      }

      mockSlackClient.conversations.history.mockRejectedValue(rateLimitError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Rate Limit Error'
      )
    })

    it('should auto-join channel when not_in_channel error occurs', async () => {
      const notInChannelError = {
        data: { error: 'not_in_channel' },
        message: 'Not in channel',
      }

      const mockHistory = {
        messages: [{ user: 'U123', text: 'Hello' }],
      }

      // First call fails with not_in_channel
      mockSlackClient.conversations.history
        .mockRejectedValueOnce(notInChannelError)
        // Second call succeeds after join
        .mockResolvedValueOnce(mockHistory)

      mockSlackClient.conversations.join.mockResolvedValue({ ok: true })

      const result = await fetchChannelHistory('C123456')

      expect(mockSlackClient.conversations.join).toHaveBeenCalledWith({
        channel: 'C123456',
      })
      expect(mockSlackClient.conversations.history).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockHistory)
    })

    it('should handle rate limit error during auto-join', async () => {
      const notInChannelError = {
        data: { error: 'not_in_channel' },
        message: 'Not in channel',
      }

      const rateLimitError = {
        data: { error: 'rate_limited' },
        status: 429,
        message: 'Rate limit exceeded',
      }

      mockSlackClient.conversations.history.mockRejectedValue(notInChannelError)
      mockSlackClient.conversations.join.mockRejectedValue(rateLimitError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Rate Limit Error (Auto-Join)'
      )
    })

    it('should handle other errors during auto-join', async () => {
      const notInChannelError = {
        data: { error: 'not_in_channel' },
        message: 'Not in channel',
      }

      const joinError = {
        data: { error: 'channel_not_found' },
        message: 'Channel not found',
      }

      mockSlackClient.conversations.history.mockRejectedValue(notInChannelError)
      mockSlackClient.conversations.join.mockRejectedValue(joinError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Error (Auto-Join Failed)'
      )
    })

    it('should handle general API errors', async () => {
      const apiError = {
        data: { error: 'invalid_auth' },
        message: 'Invalid authentication',
      }

      mockSlackClient.conversations.history.mockRejectedValue(apiError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Error'
      )
    })

    it('should handle errors with code property', async () => {
      const apiError = {
        code: 'SLACK_API_ERROR',
        message: 'API error',
      }

      mockSlackClient.conversations.history.mockRejectedValue(apiError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Error'
      )
    })

    it('should handle errors with unknown format', async () => {
      const unknownError = {
        message: 'Unknown error',
      }

      mockSlackClient.conversations.history.mockRejectedValue(unknownError)

      await expect(fetchChannelHistory('C123456')).rejects.toThrow(
        'Slack API Error'
      )
    })
  })

  describe('fetchRecentMessages', () => {
    it('should fetch messages from last day by default', async () => {
      const mockHistory = {
        messages: [{ user: 'U123', text: 'Hello' }],
      }

      mockSlackClient.conversations.history.mockResolvedValue(mockHistory)

      const result = await fetchRecentMessages('C123456')

      expect(result).toEqual(mockHistory)
      expect(mockSlackClient.conversations.history).toHaveBeenCalled()
      
      // Verify oldest timestamp is approximately 1 day ago
      const callArgs = mockSlackClient.conversations.history.mock.calls[0][0]
      const oldestTimestamp = parseInt(callArgs.oldest)
      const expectedTimestamp = Date.now() - 86400000 // 1 day in ms
      const difference = Math.abs(oldestTimestamp - expectedTimestamp / 1000)
      
      expect(difference).toBeLessThan(5) // Allow 5 second difference
    })

    it('should fetch messages from N days ago', async () => {
      const mockHistory = {
        messages: [{ user: 'U123', text: 'Hello' }],
      }

      mockSlackClient.conversations.history.mockResolvedValue(mockHistory)

      await fetchRecentMessages('C123456', 3)

      const callArgs = mockSlackClient.conversations.history.mock.calls[0][0]
      const oldestTimestamp = parseInt(callArgs.oldest)
      const expectedTimestamp = Date.now() - (3 * 86400000)
      const difference = Math.abs(oldestTimestamp - expectedTimestamp / 1000)
      
      expect(difference).toBeLessThan(5)
    })

    it('should handle errors from fetchChannelHistory', async () => {
      const apiError = {
        data: { error: 'invalid_channel' },
        message: 'Invalid channel',
      }

      mockSlackClient.conversations.history.mockRejectedValue(apiError)

      await expect(fetchRecentMessages('C123456')).rejects.toThrow(
        'Slack API Error'
      )
    })
  })
})





