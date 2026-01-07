// Mock must be defined before importing the module
jest.mock('../../../lib/prisma', () => ({
    prisma: require('../../utils/mocks').mockPrisma,
}))

import {
    createCronLog,
    updateCronLogMappingsFound,
    updateCronLogCompleted,
    finalizeCronLog,
    updateCronLogFailed,
    createErrorCronLog,
    CronLogMappingStatus
} from '../../../lib/services/core/cronLogService'
import { mockPrisma } from '../../utils/mocks'

describe('cronLogService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('createCronLog', () => {
        const mockCadenceResult = {
            shouldSync: true,
            cadences: ['daily', 'weekly'] as const,
            dayOfWeek: 5,
            dayOfMonth: 31,
            lastDayOfMonth: 31,
        }

        it('should create a cron log entry successfully', async () => {
            const mockCronLog = { id: 1 }
            mockPrisma.cronLog.create.mockResolvedValue(mockCronLog)

            const result = await createCronLog(mockCadenceResult)

            expect(result).toBe(1)
            expect(mockPrisma.cronLog.create).toHaveBeenCalledWith({
                data: {
                    status: 'running',
                    cadences: ['daily', 'weekly'],
                    dayOfWeek: 5,
                    dayOfMonth: 31,
                    lastDayOfMonth: 31,
                    mappingsFound: 0,
                    mappingsExecuted: 0,
                    mappingsFailed: 0,
                }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Creating cron log entry...')
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Created cron log entry with ID: 1')
        })

        it('should handle empty cadences array', async () => {
            const mockCronLog = { id: 2 }
            mockPrisma.cronLog.create.mockResolvedValue(mockCronLog)
            const cadenceResult = {
                ...mockCadenceResult,
                cadences: [] as const,
            }

            const result = await createCronLog(cadenceResult)

            expect(result).toBe(2)
            expect(mockPrisma.cronLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    cadences: [],
                })
            })
        })

        it('should return null on database error', async () => {
            const error = new Error('Database connection failed')
            mockPrisma.cronLog.create.mockRejectedValue(error)

            const result = await createCronLog(mockCadenceResult)

            expect(result).toBeNull()
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Failed to create cron log entry:', error)
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Error details:', expect.objectContaining({
                message: 'Database connection failed'
            }))
        })
    })

    describe('updateCronLogMappingsFound', () => {
        it('should update cron log with mappings found count', async () => {
            mockPrisma.cronLog.update.mockResolvedValue({})

            await updateCronLogMappingsFound(1, 5)

            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { mappingsFound: 5 }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Updated cron log 1 with 5 mappings found')
        })

        it('should throw error on database failure', async () => {
            const error = new Error('Update failed')
            mockPrisma.cronLog.update.mockRejectedValue(error)

            await expect(updateCronLogMappingsFound(1, 5)).rejects.toThrow('Update failed')
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Failed to update mappings found:', error)
        })
    })

    describe('updateCronLogCompleted', () => {
        it('should update cron log status to completed', async () => {
            mockPrisma.cronLog.update.mockResolvedValue({})
            const mockDate = new Date('2024-01-15T10:00:00Z')
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

            await updateCronLogCompleted(1)

            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    status: 'completed',
                    completedAt: mockDate,
                }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Updated cron log 1 to completed')
        })

        it('should throw error on database failure', async () => {
            const error = new Error('Update failed')
            mockPrisma.cronLog.update.mockRejectedValue(error)

            await expect(updateCronLogCompleted(1)).rejects.toThrow('Update failed')
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Failed to update cron log:', error)
        })
    })

    describe('finalizeCronLog', () => {
        it('should create mapping log entries and update cron log with final status', async () => {
            const mappingStatuses = new Map<number, CronLogMappingStatus>([
                [1, { success: true }],
                [2, { success: false, error: 'Test error' }],
                [3, { success: true }],
            ])

            mockPrisma.cronLogMapping.create
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
            mockPrisma.cronLog.update.mockResolvedValue({})

            await finalizeCronLog(1, mappingStatuses)

            // Should create 3 mapping log entries
            expect(mockPrisma.cronLogMapping.create).toHaveBeenCalledTimes(3)
            expect(mockPrisma.cronLogMapping.create).toHaveBeenNthCalledWith(1, {
                data: {
                    cronLogId: 1,
                    mappingId: 1,
                    status: 'success',
                    errorMessage: null,
                }
            })
            expect(mockPrisma.cronLogMapping.create).toHaveBeenNthCalledWith(2, {
                data: {
                    cronLogId: 1,
                    mappingId: 2,
                    status: 'failed',
                    errorMessage: 'Test error',
                }
            })
            expect(mockPrisma.cronLogMapping.create).toHaveBeenNthCalledWith(3, {
                data: {
                    cronLogId: 1,
                    mappingId: 3,
                    status: 'success',
                    errorMessage: null,
                }
            })

            // Should update cron log with final counts (2 executed, 1 failed)
            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    status: 'completed',
                    completedAt: expect.any(Date),
                    mappingsExecuted: 2,
                    mappingsFailed: 1,
                }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Updated cron log 1 with final status (2 executed, 1 failed)')
        })

        it('should continue processing even if some mapping log entries fail', async () => {
            const mappingStatuses = new Map<number, CronLogMappingStatus>([
                [1, { success: true }],
                [2, { success: false, error: 'Test error' }],
            ])

            mockPrisma.cronLogMapping.create
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Mapping log creation failed'))
            mockPrisma.cronLog.update.mockResolvedValue({})

            await finalizeCronLog(1, mappingStatuses)

            // Should still update cron log (1 executed, 1 failed, but only 1 mapping log created)
            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    mappingsExecuted: 1,
                    mappingsFailed: 0, // The failed mapping log wasn't created, so it's not counted
                })
            })
            expect(console.error).toHaveBeenCalledWith(
                '[CRON LOG] Failed to create mapping log entry for mapping 2:',
                expect.any(Error)
            )
        })

        it('should handle empty mapping statuses', async () => {
            const mappingStatuses = new Map<number, CronLogMappingStatus>()
            mockPrisma.cronLog.update.mockResolvedValue({})

            await finalizeCronLog(1, mappingStatuses)

            expect(mockPrisma.cronLogMapping.create).not.toHaveBeenCalled()
            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    mappingsExecuted: 0,
                    mappingsFailed: 0,
                })
            })
        })

        it('should throw error if cron log update fails', async () => {
            const mappingStatuses = new Map<number, CronLogMappingStatus>([
                [1, { success: true }],
            ])
            mockPrisma.cronLogMapping.create.mockResolvedValue({})
            const error = new Error('Update failed')
            mockPrisma.cronLog.update.mockRejectedValue(error)

            await expect(finalizeCronLog(1, mappingStatuses)).rejects.toThrow('Update failed')
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Failed to update cron log with final status:', error)
        })
    })

    describe('updateCronLogFailed', () => {
        it('should update cron log with failed status and error message', async () => {
            mockPrisma.cronLog.update.mockResolvedValue({})
            const mockDate = new Date('2024-01-15T10:00:00Z')
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

            await updateCronLogFailed(1, 'Sync failed due to API error')

            expect(mockPrisma.cronLog.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    status: 'failed',
                    completedAt: mockDate,
                    errorMessage: 'Sync failed due to API error',
                }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Updated cron log 1 with error status')
        })

        it('should throw error on database failure', async () => {
            const error = new Error('Update failed')
            mockPrisma.cronLog.update.mockRejectedValue(error)

            await expect(updateCronLogFailed(1, 'Test error')).rejects.toThrow('Update failed')
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] Failed to update cron log with error:', error)
        })
    })

    describe('createErrorCronLog', () => {
        it('should create an error cron log entry successfully', async () => {
            const mockErrorLog = { id: 99 }
            mockPrisma.cronLog.create.mockResolvedValue(mockErrorLog)

            const result = await createErrorCronLog('Critical sync failure')

            expect(result).toBe(99)
            expect(mockPrisma.cronLog.create).toHaveBeenCalledWith({
                data: {
                    status: 'failed',
                    completedAt: expect.any(Date),
                    errorMessage: 'Critical sync failure',
                    cadences: [],
                    mappingsFound: 0,
                    mappingsExecuted: 0,
                    mappingsFailed: 0,
                }
            })
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Creating error log entry for failed sync...')
            expect(console.log).toHaveBeenCalledWith('[CRON LOG] Created error log entry with ID: 99')
        })

        it('should return null on database error', async () => {
            const error = new Error('Database connection failed')
            mockPrisma.cronLog.create.mockRejectedValue(error)

            const result = await createErrorCronLog('Test error')

            expect(result).toBeNull()
            expect(console.error).toHaveBeenCalledWith('[CRON LOG] CRITICAL: Failed to create error log entry:', error)
        })

        it('should handle empty error message', async () => {
            const mockErrorLog = { id: 100 }
            mockPrisma.cronLog.create.mockResolvedValue(mockErrorLog)

            const result = await createErrorCronLog('')

            expect(result).toBe(100)
            expect(mockPrisma.cronLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    errorMessage: '',
                })
            })
        })
    })
})

