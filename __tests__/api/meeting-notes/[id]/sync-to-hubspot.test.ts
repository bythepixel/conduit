import handler from '../../../../../pages/api/meeting-notes/[id]/sync-to-hubspot'
import { createMockRequest, createMockResponse, createMockSession } from '../../../utils/testHelpers'
import { mockPrisma } from '../../../utils/mocks'
import { syncMeetingNoteToHubSpot } from '../../../../../lib/services/hubspotService'
import { getServerSession } from 'next-auth/next'

// Mock Prisma
jest.mock('../../../../../lib/prisma', () => ({
  prisma: require('../../../utils/mocks').mockPrisma,
}))

// Mock hubspotService
jest.mock('../../../../../lib/services/hubspotService', () => ({
  syncMeetingNoteToHubSpot: jest.fn(),
}))

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../../lib/config/auth', () => ({
  authOptions: {},
}))

describe('/api/meeting-notes/[id]/sync-to-hubspot', () => {
  let req: any
  let res: any

  beforeEach(() => {
    jest.clearAllMocks()
    req = createMockRequest('POST', {}, { id: '1' })
    res = createMockResponse()
    ;(getServerSession as jest.Mock).mockResolvedValue(createMockSession())
  })

  it('should return 401 if not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('should sync meeting note to HubSpot successfully', async () => {
    const mockUpdatedNote = {
      id: 1,
      meetingId: 'meeting-1',
      title: 'Test Meeting',
      hubspotCompanyId: 1,
      syncedToHubspot: true,
      hubspotCompany: {
        id: 1,
        name: 'Test Company',
        btpAbbreviation: 'TEST',
      },
    }

    ;(syncMeetingNoteToHubSpot as jest.Mock).mockResolvedValue(undefined)
    mockPrisma.meetingNote.findUnique.mockResolvedValue(mockUpdatedNote)

    await handler(req, res)

    expect(syncMeetingNoteToHubSpot).toHaveBeenCalledWith(1)
    expect(mockPrisma.meetingNote.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: expect.objectContaining({
        hubspotCompany: expect.anything(),
      }),
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Meeting note synced to HubSpot successfully',
      note: mockUpdatedNote,
    })
  })

  it('should return 400 if meeting note ID is invalid', async () => {
    req = createMockRequest('POST', {}, { id: 'invalid' })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid meeting note ID',
    })
    expect(syncMeetingNoteToHubSpot).not.toHaveBeenCalled()
  })

  it('should return 405 for non-POST methods', async () => {
    req = createMockRequest('GET', {}, { id: '1' })

    await handler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST'])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.end).toHaveBeenCalledWith('Method GET Not Allowed')
  })

  it('should handle sync errors', async () => {
    const error = new Error('Meeting note does not have a relationship with a HubSpot Company')
    ;(syncMeetingNoteToHubSpot as jest.Mock).mockRejectedValue(error)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to sync meeting note to HubSpot',
      details: 'Meeting note does not have a relationship with a HubSpot Company',
    })
  })

  it('should handle database errors when fetching updated note', async () => {
    ;(syncMeetingNoteToHubSpot as jest.Mock).mockResolvedValue(undefined)
    const error = new Error('Database error')
    mockPrisma.meetingNote.findUnique.mockRejectedValue(error)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to sync meeting note to HubSpot',
      details: 'Database error',
    })
  })
})

