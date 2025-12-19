import handler from '../../../pages/api/prompts/[id]'
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

describe('/api/prompts/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  describe('DELETE', () => {
    it('should delete a prompt', async () => {
      const prompt = {
        id: 1,
        name: 'Test Prompt',
        isActive: false,
      }

      mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)
      mockPrisma.prompt.delete.mockResolvedValue({} as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 404 when prompt not found', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue(null)

      const req = createMockRequest('DELETE', {}, { id: '999' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prompt not found',
      })
    })

    it('should prevent deleting active prompt', async () => {
      const prompt = {
        id: 1,
        name: 'Active Prompt',
        isActive: true,
      }

      mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.delete).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete the active prompt. Please activate another prompt first.',
      })
    })

    it('should handle deletion errors', async () => {
      const prompt = {
        id: 1,
        isActive: false,
      }

      mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)
      mockPrisma.prompt.delete.mockRejectedValue(new Error('Deletion failed'))

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('PUT', () => {
    it('should update a prompt', async () => {
      const updatedPrompt = {
        id: 1,
        name: 'Updated Prompt',
        content: 'Updated content',
        isActive: false,
      }

      mockPrisma.prompt.update.mockResolvedValue(updatedPrompt as any)

      const req = createMockRequest('PUT', {
        name: 'Updated Prompt',
        content: 'Updated content',
        isActive: false,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'Updated Prompt',
          content: 'Updated content',
          isActive: false,
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(updatedPrompt)
    })

    it('should deactivate other prompts when setting as active', async () => {
      const updatedPrompt = {
        id: 1,
        name: 'Active Prompt',
        content: 'Content',
        isActive: true,
      }

      mockPrisma.prompt.updateMany.mockResolvedValue({ count: 2 } as any)
      mockPrisma.prompt.update.mockResolvedValue(updatedPrompt as any)

      const req = createMockRequest('PUT', {
        name: 'Active Prompt',
        content: 'Content',
        isActive: true,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.updateMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          id: { not: 1 },
        },
        data: { isActive: false },
      })
    })

    it('should return 400 when name is missing', async () => {
      const req = createMockRequest('PUT', {
        content: 'Content only',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Name and content are required',
      })
    })

    it('should return 400 when content is missing', async () => {
      const req = createMockRequest('PUT', {
        name: 'Name only',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Name and content are required',
      })
    })

    it('should handle Prisma client not updated error', async () => {
      const error = {
        message: 'updateMany is not defined',
      }

      mockPrisma.prompt.updateMany.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        name: 'Test',
        content: 'Content',
        isActive: true,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate',
      })
    })

    it('should handle general update errors', async () => {
      const error = {
        message: 'Update failed',
      }

      mockPrisma.prompt.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        name: 'Test',
        content: 'Content',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Update failed',
      })
    })
  })
})




