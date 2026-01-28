import { prisma } from '../../prisma'

export async function createGitSpotReleaseCronLog(): Promise<number | null> {
  try {
    const log = await prisma.gitSpotReleaseCronLog.create({
      data: {
        status: 'running',
        errors: [],
      },
    })
    return log.id
  } catch (e: any) {
    console.error('[GITSPOT CRON LOG] Failed to create cron log entry:', e)
    return null
  }
}

export async function updateGitSpotReleaseCronLogMappingsFound(cronLogId: number, count: number): Promise<void> {
  try {
    await prisma.gitSpotReleaseCronLog.update({
      where: { id: cronLogId },
      data: { mappingsFound: count },
    })
  } catch (e: any) {
    console.error('[GITSPOT CRON LOG] Failed to update mappings found:', e)
  }
}

export async function createGitSpotReleaseCronLogMapping(params: {
  cronLogId: number
  mappingId: number
  status: 'success' | 'failed' | 'skipped'
  notesCreated: number
  errorMessage?: string
}): Promise<void> {
  const { cronLogId, mappingId, status, notesCreated, errorMessage } = params
  try {
    await prisma.gitSpotReleaseCronLogMapping.create({
      data: {
        cronLogId,
        mappingId,
        status,
        notesCreated,
        errorMessage: errorMessage || null,
      },
    })
  } catch (e: any) {
    // Ignore duplicates if we somehow retry
    if (e?.code === 'P2002') return
    console.error('[GITSPOT CRON LOG] Failed to create mapping log entry:', e)
  }
}

export async function finalizeGitSpotReleaseCronLog(params: {
  cronLogId: number
  mappingsExecuted: number
  mappingsFailed: number
  mappingsSkipped: number
  notesCreated: number
  errors: string[]
}): Promise<void> {
  const { cronLogId, mappingsExecuted, mappingsFailed, mappingsSkipped, notesCreated, errors } = params

  const status = mappingsFailed > 0 ? 'failed' : 'completed'
  const errorMessage = errors.length > 0 ? errors[0] : null

  try {
    await prisma.gitSpotReleaseCronLog.update({
      where: { id: cronLogId },
      data: {
        status,
        completedAt: new Date(),
        mappingsExecuted,
        mappingsFailed,
        mappingsSkipped,
        notesCreated,
        errors,
        errorMessage,
      },
    })
  } catch (e: any) {
    console.error('[GITSPOT CRON LOG] Failed to finalize cron log:', e)
  }
}

export async function failGitSpotReleaseCronLog(cronLogId: number, errorMessage: string, errors?: string[]): Promise<void> {
  try {
    await prisma.gitSpotReleaseCronLog.update({
      where: { id: cronLogId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
        errors: errors || [errorMessage],
      },
    })
  } catch (e: any) {
    console.error('[GITSPOT CRON LOG] Failed to mark cron log failed:', e)
  }
}

