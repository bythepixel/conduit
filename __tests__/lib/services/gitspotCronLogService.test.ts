import {
  createGitSpotReleaseCronLog,
  updateGitSpotReleaseCronLogMappingsFound,
  createGitSpotReleaseCronLogMapping,
  finalizeGitSpotReleaseCronLog,
  failGitSpotReleaseCronLog,
} from '../../../lib/services/gitspot/gitspotCronLogService'
import { mockPrisma } from '../../utils/mocks'

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

describe('gitspotCronLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a cron log entry', async () => {
    mockPrisma.gitSpotReleaseCronLog.create.mockResolvedValue({ id: 42 })

    const result = await createGitSpotReleaseCronLog()

    expect(result).toBe(42)
    expect(mockPrisma.gitSpotReleaseCronLog.create).toHaveBeenCalledWith({
      data: { status: 'running', errors: [] },
    })
  })

  it('updates mappings found count', async () => {
    await updateGitSpotReleaseCronLogMappingsFound(5, 12)

    expect(mockPrisma.gitSpotReleaseCronLog.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { mappingsFound: 12 },
    })
  })

  it('creates a mapping log entry', async () => {
    await createGitSpotReleaseCronLogMapping({
      cronLogId: 1,
      mappingId: 2,
      status: 'success',
      notesCreated: 3,
    })

    expect(mockPrisma.gitSpotReleaseCronLogMapping.create).toHaveBeenCalledWith({
      data: {
        cronLogId: 1,
        mappingId: 2,
        status: 'success',
        notesCreated: 3,
        errorMessage: null,
      },
    })
  })

  it('finalizes cron log entry', async () => {
    await finalizeGitSpotReleaseCronLog({
      cronLogId: 10,
      mappingsExecuted: 2,
      mappingsFailed: 1,
      mappingsSkipped: 0,
      notesCreated: 5,
      errors: ['error'],
    })

    expect(mockPrisma.gitSpotReleaseCronLog.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        status: 'failed',
        mappingsExecuted: 2,
        mappingsFailed: 1,
        mappingsSkipped: 0,
        notesCreated: 5,
        errors: ['error'],
        errorMessage: 'error',
      }),
    })
  })

  it('marks cron log as failed', async () => {
    await failGitSpotReleaseCronLog(11, 'boom')

    expect(mockPrisma.gitSpotReleaseCronLog.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        status: 'failed',
        completedAt: expect.any(Date),
        errorMessage: 'boom',
        errors: ['boom'],
      },
    })
  })
})
