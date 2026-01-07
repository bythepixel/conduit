import handler from '../../../pages/api/prompts/index'
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

describe('/api/prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  describe('GET', () => {
    it('should return list of prompts', async () => {
      const mockPrompts = [
        {
          id: 1,
          name: 'Prompt 1',
          content: 'Content 1',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          name: 'Prompt 2',
          content: 'Content 2',
          isActive: false,
          createdAt: new Date(),
        },
      ]

      mockPrisma.prompt.findMany.mockResolvedValue(mockPrompts as any)

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith({
        orderBy: [
          { isActive: 'desc' },
          { createdAt: 'desc' },
        ],
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockPrompts)
    })
  })

  describe('POST', () => {
    it('should create a prompt', async () => {
      const newPrompt = {
        id: 1,
        name: 'New Prompt',
        content: 'Prompt content',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.prompt.create.mockResolvedValue(newPrompt as any)

      const req = createMockRequest('POST', {
        name: 'New Prompt',
        content: 'Prompt content',
        isActive: false,
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.create).toHaveBeenCalledWith({
        data: {
          name: 'New Prompt',
          content: 'Prompt content',
          isActive: false,
        },
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(newPrompt)
    })

    it('should deactivate other prompts when setting as active', async () => {
      const newPrompt = {
        id: 1,
        name: 'Active Prompt',
        content: 'Content',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.prompt.updateMany.mockResolvedValue({ count: 2 } as any)
      mockPrisma.prompt.create.mockResolvedValue(newPrompt as any)

      const req = createMockRequest('POST', {
        name: 'Active Prompt',
        content: 'Content',
        isActive: true,
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.prompt.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      })
      expect(mockPrisma.prompt.create).toHaveBeenCalledWith({
        data: {
          name: 'Active Prompt',
          content: 'Content',
          isActive: true,
        },
      })
    })

    it('should return 400 when name is missing', async () => {
      const req = createMockRequest('POST', {
        content: 'Content only',
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Name and content are required',
      })
    })

    it('should return 400 when content is missing', async () => {
      const req = createMockRequest('POST', {
        name: 'Name only',
      })
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

      const req = createMockRequest('POST', {
        name: 'Test',
        content: 'Content',
        isActive: true,
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate',
      })
    })

    it('should handle general creation errors', async () => {
      const error = {
        message: 'Creation failed',
      }

      mockPrisma.prompt.create.mockRejectedValue(error)

      const req = createMockRequest('POST', {
        name: 'Test',
        content: 'Content',
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







