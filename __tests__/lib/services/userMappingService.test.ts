import { getUserMap, replaceUserIdsInText, formatMessagesForSummary } from '../../../lib/services/userMappingService'
import { mockPrisma } from '../../utils/mocks'

// Mock must be defined before importing the module
jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

describe('userMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserMap', () => {
    it('should create a map of Slack IDs to names', async () => {
      const mockUsers = [
        { slackId: 'U123', firstName: 'John', lastName: 'Doe' },
        { slackId: 'U456', firstName: 'Jane', lastName: 'Smith' },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as any)
      
      const userMap = await getUserMap()
      
      expect(userMap.get('U123')).toBe('John Doe')
      expect(userMap.get('U456')).toBe('Jane Smith')
      expect(userMap.size).toBe(2)
    })

    it('should skip users without slackId', async () => {
      const mockUsers = [
        { slackId: 'U123', firstName: 'John', lastName: 'Doe' },
        { slackId: null, firstName: 'Jane', lastName: 'Smith' },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as any)
      
      const userMap = await getUserMap()
      
      expect(userMap.get('U123')).toBe('John Doe')
      expect(userMap.size).toBe(1)
    })
  })

  describe('replaceUserIdsInText', () => {
    it('should replace Slack user IDs with names', () => {
      const userMap = new Map([
        ['U123', 'John Doe'],
        ['U456', 'Jane Smith'],
      ])
      
      const text = 'Hey <@U123> and <@U456>!'
      const result = replaceUserIdsInText(text, userMap)
      
      expect(result).toBe('Hey @John Doe and @Jane Smith!')
    })

    it('should keep IDs that are not in the map', () => {
      const userMap = new Map([['U123', 'John Doe']])
      
      const text = 'Hey <@U123> and <@U999>!'
      const result = replaceUserIdsInText(text, userMap)
      
      expect(result).toBe('Hey @John Doe and @U999!')
    })
  })

  describe('formatMessagesForSummary', () => {
    it('should format messages with user names', () => {
      const userMap = new Map([
        ['U123', 'John Doe'],
        ['U456', 'Jane Smith'],
      ])
      
      const messages = [
        { user: 'U123', text: 'Hello everyone' },
        { user: 'U456', text: 'Hi there!' },
      ]
      
      const result = formatMessagesForSummary(messages as any, userMap)
      
      expect(result).toContain('John Doe: Hello everyone')
      expect(result).toContain('Jane Smith: Hi there!')
    })

    it('should handle messages without user IDs', () => {
      const userMap = new Map([['U123', 'John Doe']])
      
      const messages = [
        { user: undefined, text: 'System message' },
        { user: 'U123', text: 'User message' },
      ]
      
      const result = formatMessagesForSummary(messages as any, userMap)
      
      expect(result).toContain('Unknown: System message')
      expect(result).toContain('John Doe: User message')
    })

    it('should replace mentions in message text', () => {
      const userMap = new Map([
        ['U123', 'John Doe'],
        ['U456', 'Jane Smith'],
      ])
      
      const messages = [
        { user: 'U123', text: 'Hey <@U456>!' },
      ]
      
      const result = formatMessagesForSummary(messages as any, userMap)
      
      expect(result).toContain('John Doe: Hey @Jane Smith!')
    })
  })
})

