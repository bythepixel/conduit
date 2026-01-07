import { generateSummary, generateFallbackSummary } from '../../../lib/services/ai/openaiService'
import { mockOpenAIClient } from '../../utils/mocks'
import { getRequiredEnv } from '../../../lib/config/env'

// Mock the config/env module
jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-key'),
}))

// Mock OpenAI
jest.mock('openai', () => ({
  Configuration: jest.fn().mockImplementation(() => ({})),
  OpenAIApi: jest.fn().mockImplementation(() => mockOpenAIClient),
}))

describe('openaiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateSummary', () => {
    it('should generate summary successfully with custom prompt', async () => {
      const mockCompletion = {
        data: {
          choices: [
            {
              message: {
                content: 'This is a test summary of the conversation.',
              },
            },
          ],
        },
      }

      mockOpenAIClient.createChatCompletion.mockResolvedValue(mockCompletion)

      const result = await generateSummary(
        'User1: Hello\nUser2: Hi there',
        'Custom system prompt',
        'test-channel'
      )

      expect(result).toContain('Daily Slack Summary for test-channel')
      expect(result).toContain('This is a test summary')
      expect(mockOpenAIClient.createChatCompletion).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: 'Custom system prompt' },
          { role: 'user', content: 'User1: Hello\nUser2: Hi there' },
        ],
        model: 'gpt-3.5-turbo',
      })
    })

    it('should use default prompt when none provided', async () => {
      const mockCompletion = {
        data: {
          choices: [
            {
              message: {
                content: 'Summary text',
              },
            },
          ],
        },
      }

      mockOpenAIClient.createChatCompletion.mockResolvedValue(mockCompletion)

      await generateSummary('User1: Hello')

      expect(mockOpenAIClient.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Summarize the following Slack conversation'),
            }),
          ]),
        })
      )
    })

    it('should use channel name in summary', async () => {
      const mockCompletion = {
        data: {
          choices: [
            {
              message: {
                content: 'Summary',
              },
            },
          ],
        },
      }

      mockOpenAIClient.createChatCompletion.mockResolvedValue(mockCompletion)

      const result = await generateSummary('Messages', undefined, 'my-channel')

      expect(result).toContain('Daily Slack Summary for my-channel')
    })

    it('should use default channel label when no channel name', async () => {
      const mockCompletion = {
        data: {
          choices: [
            {
              message: {
                content: 'Summary',
              },
            },
          ],
        },
      }

      mockOpenAIClient.createChatCompletion.mockResolvedValue(mockCompletion)

      const result = await generateSummary('Messages')

      expect(result).toContain('Daily Slack Summary for channel')
    })

    it('should handle empty message content', async () => {
      const mockCompletion = {
        data: {
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
        },
      }

      mockOpenAIClient.createChatCompletion.mockResolvedValue(mockCompletion)

      const result = await generateSummary('Messages', undefined, 'test')

      expect(result).toContain('Daily Slack Summary for test')
      expect(result).toContain('\n\n')
    })

    it('should handle rate limit errors (429 status)', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limit exceeded',
            },
          },
        },
        message: 'Rate limit exceeded',
      }

      mockOpenAIClient.createChatCompletion.mockRejectedValue(rateLimitError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Rate Limit Error'
      )
    })

    it('should handle rate limit errors in message', async () => {
      const rateLimitError = {
        message: 'rate limit exceeded',
      }

      mockOpenAIClient.createChatCompletion.mockRejectedValue(rateLimitError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Rate Limit Error'
      )
    })

    it('should handle general API errors', async () => {
      const apiError = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Invalid request',
            },
          },
        },
        message: 'Bad request',
      }

      mockOpenAIClient.createChatCompletion.mockRejectedValue(apiError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Error: Invalid request'
      )
    })

    it('should handle errors with response.data.error.message', async () => {
      const apiError = {
        response: {
          data: {
            error: {
              message: 'Custom error message',
            },
          },
        },
        message: 'Fallback message',
      }

      mockOpenAIClient.createChatCompletion.mockRejectedValue(apiError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Error: Custom error message'
      )
    })

    it('should handle errors with only message', async () => {
      const apiError = {
        message: 'Simple error message',
      }

      mockOpenAIClient.createChatCompletion.mockRejectedValue(apiError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Error: Simple error message'
      )
    })

    it('should handle errors with unknown format', async () => {
      const unknownError = {}

      mockOpenAIClient.createChatCompletion.mockRejectedValue(unknownError)

      await expect(generateSummary('Messages')).rejects.toThrow(
        'OpenAI API Error: Unknown error'
      )
    })
  })

  describe('generateFallbackSummary', () => {
    it('should generate fallback summary with messages', () => {
      const messages = [
        { user: 'U123', text: 'Hello' },
        { user: 'U456', text: 'World' },
        { user: undefined, text: 'No user' },
        { text: 'No text' },
      ]

      const result = generateFallbackSummary(messages, 'Test error')

      expect(result).toContain('Daily Slack Summary (Fallback)')
      expect(result).toContain('- <U123>: Hello')
      expect(result).toContain('- <U456>: World')
      expect(result).toContain('- <?>: No user')
      expect(result).toContain('- <?>: No text')
      expect(result).toContain('(OpenAI API Error: Test error)')
    })

    it('should handle empty messages array', () => {
      const result = generateFallbackSummary([], 'Test error')

      expect(result).toContain('Daily Slack Summary (Fallback)')
      expect(result).toContain('(OpenAI API Error: Test error)')
    })

    it('should handle messages with missing fields', () => {
      const messages = [
        {},
        { user: 'U123' },
        { text: 'Only text' },
      ]

      const result = generateFallbackSummary(messages, 'Error')

      expect(result).toContain('- <?>:')
      expect(result).toContain('- <U123>:')
      expect(result).toContain('- <?>: Only text')
    })
  })
})







