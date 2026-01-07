import { mockPrisma, mockHubSpotClient } from '../../utils/mocks'
import { getRequiredEnv } from '../../../lib/config/env'

// Mock Prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

// Mock the config/env module
jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
  getEnv: jest.fn(() => 'test-token'),
}))

// Mock HubSpot Client
jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => mockHubSpotClient),
}))

// Don't mock the service module - we'll mock the HubSpot client instead
import { syncMeetingNoteToHubSpot } from '../../../lib/services/hubspot/hubspotService'

describe('hubspotService - syncMeetingNoteToHubSpot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000)
    // Mock the HubSpot client's create method
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({ id: 'note-123' })
  })

  const mockMeetingNote = {
    id: 1,
    meetingId: 'meeting-123',
    title: 'BTPM | Onboarding',
    notes: 'Test notes',
    summary: 'Test summary',
    participants: ['user1@example.com', 'user2@example.com'],
    duration: 60,
    meetingDate: new Date('2025-01-15T10:00:00Z'),
    transcriptUrl: 'https://app.fireflies.ai/view/meeting-123',
    hubspotCompanyId: 1,
    syncedToHubspot: false,
    hubspotCompany: {
      id: 1,
      companyId: 'hubspot-company-123',
      name: 'Test Company',
      btpAbbreviation: 'BTPM',
    },
  }

  it('should sync meeting note to HubSpot successfully', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue(mockMeetingNote)
    mockPrisma.meetingNote.update.mockResolvedValue({
      ...mockMeetingNote,
      syncedToHubspot: true,
    })
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({ id: 'note-123' })

    await syncMeetingNoteToHubSpot(1)

    expect(mockPrisma.meetingNote.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        hubspotCompany: true,
      },
    })

    expect(mockHubSpotClient.crm.objects.notes.basicApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          hs_note_body: expect.stringContaining('<p><strong>Meeting: BTPM | Onboarding</strong></p>'),
        }),
        associations: expect.arrayContaining([
          expect.objectContaining({
            to: { id: 'hubspot-company-123' },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }],
          }),
        ]),
      })
    )

    expect(mockPrisma.meetingNote.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { syncedToHubspot: true },
    })
  })

  it('should throw error if meeting note not found', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue(null)

    await expect(syncMeetingNoteToHubSpot(999)).rejects.toThrow(
      'Meeting note with ID 999 not found'
    )
  })

  it('should throw error if meeting note has no HubSpot company relationship', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue({
      ...mockMeetingNote,
      hubspotCompany: null,
      hubspotCompanyId: null,
    })

    await expect(syncMeetingNoteToHubSpot(1)).rejects.toThrow(
      'Meeting note does not have a relationship with a HubSpot Company'
    )
  })

  it('should throw error if HubSpot company has no companyId', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue({
      ...mockMeetingNote,
      hubspotCompany: {
        ...mockMeetingNote.hubspotCompany,
        companyId: null,
      },
    })

    await expect(syncMeetingNoteToHubSpot(1)).rejects.toThrow(
      'HubSpot Company does not have a companyId'
    )
  })

  it('should format meeting note with all fields correctly', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue(mockMeetingNote)
    mockPrisma.meetingNote.update.mockResolvedValue({
      ...mockMeetingNote,
      syncedToHubspot: true,
    })
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({ id: 'note-123' })

    await syncMeetingNoteToHubSpot(1)

    const callArgs = mockHubSpotClient.crm.objects.notes.basicApi.create.mock.calls[0]
    const noteBody = callArgs[0]?.properties?.hs_note_body

    // Check HTML formatting
    expect(noteBody).toContain('<p><strong>Meeting: BTPM | Onboarding</strong></p>')
    expect(noteBody).toContain('<p><strong>Date:</strong>')
    expect(noteBody).toContain('<p><strong>Duration:</strong> 1h 0m</p>')
    expect(noteBody).toContain('<p><strong>Participants:</strong>')
    expect(noteBody).toContain('<p><strong>Summary:</strong>')
    expect(noteBody).toContain('<p><strong>Notes:</strong>')
    expect(noteBody).toContain('<p><strong>Transcript:</strong>')
  })

  it('should format meeting note with minimal fields', async () => {
    const minimalNote = {
      ...mockMeetingNote,
      title: 'Test Meeting',
      notes: null,
      summary: null,
      duration: null,
      meetingDate: null,
      transcriptUrl: null,
      participants: [],
    }

    mockPrisma.meetingNote.findUnique.mockResolvedValue(minimalNote)
    mockPrisma.meetingNote.update.mockResolvedValue({
      ...minimalNote,
      syncedToHubspot: true,
    })
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({ id: 'note-123' })

    await syncMeetingNoteToHubSpot(1)

    const callArgs = mockHubSpotClient.crm.objects.notes.basicApi.create.mock.calls[0]
    const noteBody = callArgs[0]?.properties?.hs_note_body

    expect(noteBody).toContain('<p><strong>Meeting: Test Meeting</strong></p>')
    expect(noteBody).not.toContain('<p><strong>Date:</strong>')
    expect(noteBody).not.toContain('<p><strong>Duration:</strong>')
    expect(noteBody).not.toContain('<p><strong>Participants:</strong>')
  })

  it('should replace newlines with <br> tags in summary and notes', async () => {
    const noteWithNewlines = {
      ...mockMeetingNote,
      summary: 'Line 1\nLine 2\nLine 3',
      notes: 'Note 1\nNote 2',
    }

    mockPrisma.meetingNote.findUnique.mockResolvedValue(noteWithNewlines)
    mockPrisma.meetingNote.update.mockResolvedValue({
      ...noteWithNewlines,
      syncedToHubspot: true,
    })
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockResolvedValue({ id: 'note-123' })

    await syncMeetingNoteToHubSpot(1)

    const callArgs = mockHubSpotClient.crm.objects.notes.basicApi.create.mock.calls[0]
    const noteBody = callArgs[0]?.properties?.hs_note_body

    expect(noteBody).toContain('Line 1<br>Line 2<br>Line 3')
    expect(noteBody).toContain('Note 1<br>Note 2')
  })

  it('should handle errors from createCompanyNote', async () => {
    mockPrisma.meetingNote.findUnique.mockResolvedValue(mockMeetingNote)
    const error = new Error('HubSpot API Error')
    mockHubSpotClient.crm.objects.notes.basicApi.create.mockRejectedValue(error)

    await expect(syncMeetingNoteToHubSpot(1)).rejects.toThrow('HubSpot API Error')
    expect(mockPrisma.meetingNote.update).not.toHaveBeenCalled()
  })
})

