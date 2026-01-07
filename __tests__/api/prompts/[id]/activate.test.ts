import handler from '../../../../pages/api/prompts/[id]/activate'
import { createMockRequest, createMockResponse, createMockSession } from '../../../utils/testHelpers'
import { mockPrisma } from '../../../utils/mocks'
import { getServerSession } from 'next-auth/next'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../../pages/api/auth/[...nextauth]', () => ({
  authOptions: {},
}))

jest.mock('../../../../lib/prisma', () => ({
  prisma: require('../../../utils/mocks').mockPrisma,
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('/api/prompts/[id]/activate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  it('should activate a prompt', async () => {
    const prompt = {
      id: 1,
      name: 'Test Prompt',
      isActive: false,
    }

    const activatedPrompt = {
      id: 1,
      name: 'Test Prompt',
      isActive: true,
    }

    mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)
    mockPrisma.prompt.updateMany.mockResolvedValue({ count: 1 } as any)
    mockPrisma.prompt.update.mockResolvedValue(activatedPrompt as any)

    const req = createMockRequest('POST', {}, { id: '1' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.prompt.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    })
    expect(mockPrisma.prompt.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(activatedPrompt)
  })

  it('should return 404 when prompt not found', async () => {
    mockPrisma.prompt.findUnique.mockResolvedValue(null)

    const req = createMockRequest('POST', {}, { id: '999' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Prompt not found',
    })
  })

  it('should handle Prisma client not updated error', async () => {
    const prompt = {
      id: 1,
      isActive: false,
    }

    const error = {
      message: 'updateMany is not defined',
    }

    mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)
    mockPrisma.prompt.updateMany.mockRejectedValue(error)

    const req = createMockRequest('POST', {}, { id: '1' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate',
    })
  })

  it('should handle general errors', async () => {
    const prompt = {
      id: 1,
      isActive: false,
    }

    const error = {
      message: 'Activation failed',
    }

    mockPrisma.prompt.findUnique.mockResolvedValue(prompt as any)
    mockPrisma.prompt.updateMany.mockResolvedValue({ count: 0 } as any)
    mockPrisma.prompt.update.mockRejectedValue(error)

    const req = createMockRequest('POST', {}, { id: '1' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Activation failed',
    })
  })

  it('should reject unsupported methods', async () => {
    const req = createMockRequest('GET', {}, { id: '1' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST'])
    expect(res.status).toHaveBeenCalledWith(405)
  })
})







