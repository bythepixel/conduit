import handler from '../../../../../pages/api/meeting-notes/[id]/link'
import { createMockRequest, createMockResponse, createMockSession } from '../../../utils/testHelpers'
import { mockPrisma } from '../../../utils/mocks'
import { getServerSession } from 'next-auth/next'

// Mock Prisma
jest.mock('../../../../../lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../../../lib/config/auth', () => ({
  authOptions: {},
}))

describe('/api/meeting-notes/[id]/link', () => {
  let req: any
  let res: any

  beforeEach(() => {
    jest.clearAllMocks()
    req = createMockRequest('POST', { hubspotCompanyId: 1 }, { id: '1' })
    res = createMockResponse()
    ;(getServerSession as jest.Mock).mockResolvedValue(createMockSession())
  })

  it('should return 401 if not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('should link meeting note to HubSpot company', async () => {
    const mockUpdatedNote = {
      id: 1,
      meetingId: 'meeting-1',
      title: 'Test Meeting',
      hubspotCompanyId: 1,
      hubspotCompany: {
        id: 1,
        name: 'Test Company',
        btpAbbreviation: 'TEST',
      },
    }

    mockPrisma.meetingNote.update.mockResolvedValue(mockUpdatedNote)

    await handler(req, res)

    expect(mockPrisma.meetingNote.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        hubspotCompanyId: 1,
      },
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
    expect(res.json).toHaveBeenCalledWith({
      message: 'Meeting note linked successfully',
      note: mockUpdatedNote,
    })
  })

  it('should unlink meeting note from HubSpot company when hubspotCompanyId is null', async () => {
    req = createMockRequest('POST', { hubspotCompanyId: null }, { id: '1' })
    const mockUpdatedNote = {
      id: 1,
      meetingId: 'meeting-1',
      title: 'Test Meeting',
      hubspotCompanyId: null,
      hubspotCompany: null,
    }

    mockPrisma.meetingNote.update.mockResolvedValue(mockUpdatedNote)

    await handler(req, res)

    expect(mockPrisma.meetingNote.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        hubspotCompanyId: null,
      },
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
  })

  it('should return 400 if meeting note ID is missing', async () => {
    req = createMockRequest('POST', { hubspotCompanyId: 1 }, {})

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid meeting note ID',
    })
  })

  it('should return 400 if meeting note ID is not a string', async () => {
    req = createMockRequest('POST', { hubspotCompanyId: 1 }, { id: 123 })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid meeting note ID',
    })
  })

  it('should return 400 if meeting note ID is not a valid number', async () => {
    req = createMockRequest('POST', { hubspotCompanyId: 1 }, { id: 'invalid' })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid meeting note ID format',
    })
  })

  it('should return 405 for non-POST methods', async () => {
    req = createMockRequest('GET', {}, { id: '1' })

    await handler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST'])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.end).toHaveBeenCalledWith('Method GET Not Allowed')
  })

  it('should handle database errors', async () => {
    const error = new Error('Database error')
    mockPrisma.meetingNote.update.mockRejectedValue(error)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      details: 'Database error',
    })
  })
})

