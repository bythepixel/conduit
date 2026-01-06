import { FirefliesService } from '../../../lib/services/firefliesService'
import { mockPrisma } from '../../utils/mocks'
import { getEnv } from '../../../lib/config/env'

// Mock Prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock config/env
jest.mock('../../../lib/config/env', () => ({
  getEnv: jest.fn(),
  getRequiredEnv: jest.fn(() => 'test-api-key'),
}))

// Mock fetch
global.fetch = jest.fn()

describe('FirefliesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getEnv as jest.Mock).mockReturnValue('test-api-key')
  })

  describe('findMatchingCompany', () => {
    it('should find a company by abbreviation match (case-insensitive)', async () => {
      const mockCompany = { id: 1 }
      mockPrisma.hubspotCompany.findFirst.mockResolvedValue(mockCompany)

      const result = await FirefliesService.findMatchingCompany('BTPM Meeting')

      expect(mockPrisma.hubspotCompany.findFirst).toHaveBeenCalledWith({
        where: {
          btpAbbreviation: {
            equals: 'BTPM',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })
      expect(result).toBe(1)
    })

    it('should strip trailing punctuation from first word', async () => {
      const mockCompany = { id: 2 }
      mockPrisma.hubspotCompany.findFirst.mockResolvedValue(mockCompany)

      const result = await FirefliesService.findMatchingCompany('BTPM: Onboarding')

      expect(mockPrisma.hubspotCompany.findFirst).toHaveBeenCalledWith({
        where: {
          btpAbbreviation: {
            equals: 'BTPM',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })
      expect(result).toBe(2)
    })

    it('should handle titles with pipe separator', async () => {
      const mockCompany = { id: 3 }
      mockPrisma.hubspotCompany.findFirst.mockResolvedValue(mockCompany)

      const result = await FirefliesService.findMatchingCompany('BTPM | Meeting')

      expect(mockPrisma.hubspotCompany.findFirst).toHaveBeenCalledWith({
        where: {
          btpAbbreviation: {
            equals: 'BTPM',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })
      expect(result).toBe(3)
    })

    it('should return null if title is null', async () => {
      const result = await FirefliesService.findMatchingCompany(null)
      expect(result).toBeNull()
      expect(mockPrisma.hubspotCompany.findFirst).not.toHaveBeenCalled()
    })

    it('should return null if title is empty', async () => {
      const result = await FirefliesService.findMatchingCompany('')
      expect(result).toBeNull()
      expect(mockPrisma.hubspotCompany.findFirst).not.toHaveBeenCalled()
    })

    it('should return null if title is only whitespace', async () => {
      const result = await FirefliesService.findMatchingCompany('   ')
      expect(result).toBeNull()
      expect(mockPrisma.hubspotCompany.findFirst).not.toHaveBeenCalled()
    })

    it('should return null if no company matches', async () => {
      mockPrisma.hubspotCompany.findFirst.mockResolvedValue(null)

      const result = await FirefliesService.findMatchingCompany('UNKNOWN Meeting')

      expect(result).toBeNull()
    })

    it('should handle multiple punctuation characters', async () => {
      const mockCompany = { id: 4 }
      mockPrisma.hubspotCompany.findFirst.mockResolvedValue(mockCompany)

      const result = await FirefliesService.findMatchingCompany('BTPM,.: Meeting')

      expect(mockPrisma.hubspotCompany.findFirst).toHaveBeenCalledWith({
        where: {
          btpAbbreviation: {
            equals: 'BTPM',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })
      expect(result).toBe(4)
    })
  })

  describe('processFireHookLog', () => {
    const mockFireHookLog = {
      id: 1,
      meetingId: 'meeting-123',
      processed: false,
      eventType: 'transcript_completed',
      date: new Date(),
      clientReferenceId: null,
      payload: {},
      isAuthentic: true,
      computedSignature: 'sig',
      receivedSignature: 'sig',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should return error if log not found', async () => {
      mockPrisma.fireHookLog.findUnique.mockResolvedValue(null)

      const result = await FirefliesService.processFireHookLog(999)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Fire hook log not found')
    })

    it('should return error if log already processed', async () => {
      mockPrisma.fireHookLog.findUnique.mockResolvedValue({
        ...mockFireHookLog,
        processed: true,
      })

      const result = await FirefliesService.processFireHookLog(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Log has already been processed')
    })

    it('should return error if no meeting ID', async () => {
      mockPrisma.fireHookLog.findUnique.mockResolvedValue({
        ...mockFireHookLog,
        meetingId: null,
      })

      const result = await FirefliesService.processFireHookLog(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No meeting ID in fire hook log')
    })
  })
})

