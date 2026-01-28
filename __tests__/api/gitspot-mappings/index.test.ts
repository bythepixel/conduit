import handler from '../../../pages/api/gitspot-mappings/index'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/middleware/cors', () => ({
  corsMiddleware: jest.fn(() => false),
}))

jest.mock('../../../lib/middleware/rateLimit', () => ({
  defaultRateLimiter: jest.fn(() => ({ success: true })),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>

describe('/api/gitspot-mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(100)
  })

  it('GET should return mappings', async () => {
    const mockMappings = [
      {
        id: 1,
        hubspotCompanyId: 1,
        githubRepositoryId: 1,
        hubspotCompany: { id: 1, name: 'HS Co', companyId: '123' },
        githubRepository: { id: 1, fullName: 'acme/foo', githubId: '999' },
      },
    ]

    mockPrisma.gitSpotCompanyMapping.findMany.mockResolvedValue(mockMappings as any)

    const req = createMockRequest('GET')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitSpotCompanyMapping.findMany).toHaveBeenCalledWith({
      include: { hubspotCompany: true, githubRepository: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(mockMappings)
  })

  it('POST should create a mapping', async () => {
    mockPrisma.gitSpotCompanyMapping.findUnique.mockResolvedValue(null as any)
    mockPrisma.hubspotCompany.findUnique.mockResolvedValue({ id: 1 } as any)
    mockPrisma.gitHubRepository.findUnique.mockResolvedValue({ id: 1 } as any)
    mockPrisma.gitSpotCompanyMapping.create.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST', { hubspotCompanyId: 1, githubRepositoryId: 1 })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitSpotCompanyMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { hubspotCompanyId: 1, githubRepositoryId: 1 },
      })
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST should reject duplicates', async () => {
    mockPrisma.gitSpotCompanyMapping.findUnique.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST', { hubspotCompanyId: 1, githubRepositoryId: 1 })
    const res = createMockResponse()

    await handler(req as any, res)

    // With bulk behavior, duplicates are skipped rather than erroring.
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Mappings created',
      results: { created: 0, skipped: 1, errors: [] },
    })
  })

  it('DELETE should delete a mapping', async () => {
    mockPrisma.gitSpotCompanyMapping.delete.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('DELETE', undefined, { hubspotCompanyId: '1', githubRepositoryId: '1' })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.gitSpotCompanyMapping.delete).toHaveBeenCalledWith({
      where: {
        hubspotCompanyId_githubRepositoryId: {
          hubspotCompanyId: 1,
          githubRepositoryId: 1,
        },
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

