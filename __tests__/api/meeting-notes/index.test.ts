import handler from '../../../../pages/api/meeting-notes/index'
import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { getServerSession } from 'next-auth/next'

// Mock Prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../../lib/config/auth', () => ({
  authOptions: {},
}))

describe('/api/meeting-notes', () => {
  let req: any
  let res: any

  beforeEach(() => {
    jest.clearAllMocks()
    req = createMockRequest('GET')
    res = createMockResponse()
    ;(getServerSession as jest.Mock).mockResolvedValue(createMockSession())
  })

  it('should return 401 if not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('should return meeting notes with hubspot company relationship', async () => {
    const mockNotes = [
      {
        id: 1,
        meetingId: 'meeting-1',
        title: 'Test Meeting 1',
        hubspotCompany: {
          id: 1,
          name: 'Test Company',
          btpAbbreviation: 'TEST',
        },
        syncedToHubspot: false,
      },
      {
        id: 2,
        meetingId: 'meeting-2',
        title: 'Test Meeting 2',
        hubspotCompany: null,
        syncedToHubspot: false,
      },
    ]

    mockPrisma.meetingNote.findMany.mockResolvedValue(mockNotes)

    await handler(req, res)

    expect(mockPrisma.meetingNote.findMany).toHaveBeenCalledWith({
      orderBy: { meetingDate: 'desc' },
      include: {
        hubspotCompany: {
          select: {
            id: true,
            name: true,
            btpAbbreviation: true,
          },
        },
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(mockNotes)
  })

  it('should return 405 for non-GET methods', async () => {
    req = createMockRequest('POST')

    await handler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET'])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.end).toHaveBeenCalledWith('Method POST Not Allowed')
  })
})

