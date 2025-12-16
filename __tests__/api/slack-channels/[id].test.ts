import handler from '../../../pages/api/slack-channels/[id]'
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

describe('/api/slack-channels/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  describe('DELETE', () => {
    it('should delete a channel when not used in mappings', async () => {
      mockPrisma.mappingSlackChannel.count.mockResolvedValue(0)
      mockPrisma.slackChannel.delete.mockResolvedValue({} as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.mappingSlackChannel.count).toHaveBeenCalledWith({
        where: { slackChannelId: 1 },
      })
      expect(mockPrisma.slackChannel.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('should prevent deletion when channel is used in mappings', async () => {
      mockPrisma.mappingSlackChannel.count.mockResolvedValue(3)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.delete).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete channel. It is used in 3 mapping(s). Please remove the mappings first.',
      })
    })

    it('should handle deletion errors', async () => {
      mockPrisma.mappingSlackChannel.count.mockResolvedValue(0)

      const error = new Error('Deletion failed')
      mockPrisma.slackChannel.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })

  describe('PUT', () => {
    it('should update a channel', async () => {
      const updatedChannel = {
        id: 1,
        channelId: 'C123',
        name: 'Updated Channel',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.slackChannel.update.mockResolvedValue(updatedChannel as any)

      const req = createMockRequest('PUT', {
        channelId: 'C123',
        name: 'Updated Channel',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.slackChannel.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          channelId: 'C123',
          name: 'Updated Channel',
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(updatedChannel)
    })

    it('should return 400 when channelId is missing', async () => {
      const req = createMockRequest('PUT', {
        name: 'Channel without ID',
      }, { id: '1' })
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

      mockPrisma.slackChannel.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        channelId: 'C123',
        name: 'Test Channel',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })

    it('should handle update errors', async () => {
      const error = new Error('Update failed')
      mockPrisma.slackChannel.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        channelId: 'C123',
        name: 'Test Channel',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })
})

