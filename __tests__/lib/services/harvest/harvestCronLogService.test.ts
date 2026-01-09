import {
  createHarvestInvoiceCronLog,
  updateHarvestInvoiceCronLogInvoicesFound,
  finalizeHarvestInvoiceCronLog,
  updateHarvestInvoiceCronLogFailed,
  createHarvestInvoiceErrorCronLog
} from '../../../../lib/services/harvest/harvestCronLogService'
import { mockPrisma } from '../../../utils/mocks'

jest.mock('../../../../lib/prisma', () => ({
  prisma: require('../../../utils/mocks').mockPrisma,
}))

describe('harvestCronLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createHarvestInvoiceCronLog', () => {
    it('should create a new cron log entry', async () => {
      mockPrisma.harvestInvoiceCronLog.create.mockResolvedValue({
        id: 1,
        status: 'running',
        invoicesFound: 0,
        invoicesCreated: 0,
        invoicesUpdated: 0,
        invoicesFailed: 0,
        errors: []
      } as any)

      const result = await createHarvestInvoiceCronLog()

      expect(mockPrisma.harvestInvoiceCronLog.create).toHaveBeenCalledWith({
        data: {
          status: 'running',
          invoicesFound: 0,
          invoicesCreated: 0,
          invoicesUpdated: 0,
          invoicesFailed: 0,
          errors: []
        }
      })
      expect(result).toBe(1)
    })

    it('should return null on error', async () => {
      mockPrisma.harvestInvoiceCronLog.create.mockRejectedValue(new Error('Database error'))

      const result = await createHarvestInvoiceCronLog()

      expect(result).toBeNull()
    })
  })

  describe('updateHarvestInvoiceCronLogInvoicesFound', () => {
    it('should update invoices found count', async () => {
      mockPrisma.harvestInvoiceCronLog.update.mockResolvedValue({} as any)

      await updateHarvestInvoiceCronLogInvoicesFound(1, 10)

      expect(mockPrisma.harvestInvoiceCronLog.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { invoicesFound: 10 }
      })
    })

    it('should throw error on failure', async () => {
      const error = new Error('Update failed')
      mockPrisma.harvestInvoiceCronLog.update.mockRejectedValue(error)

      await expect(updateHarvestInvoiceCronLogInvoicesFound(1, 10)).rejects.toThrow('Update failed')
    })
  })

  describe('finalizeHarvestInvoiceCronLog', () => {
    it('should finalize cron log with results', async () => {
      mockPrisma.harvestInvoiceCronLog.update.mockResolvedValue({} as any)

      await finalizeHarvestInvoiceCronLog(1, {
        created: 5,
        updated: 3,
        errors: ['Error 1']
      })

      expect(mockPrisma.harvestInvoiceCronLog.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          invoicesCreated: 5,
          invoicesUpdated: 3,
          invoicesFailed: 1,
          errors: ['Error 1']
        }
      })
    })

    it('should throw error on failure', async () => {
      const error = new Error('Finalize failed')
      mockPrisma.harvestInvoiceCronLog.update.mockRejectedValue(error)

      await expect(finalizeHarvestInvoiceCronLog(1, {
        created: 0,
        updated: 0,
        errors: []
      })).rejects.toThrow('Finalize failed')
    })
  })

  describe('updateHarvestInvoiceCronLogFailed', () => {
    it('should update cron log with error status', async () => {
      mockPrisma.harvestInvoiceCronLog.update.mockResolvedValue({} as any)

      await updateHarvestInvoiceCronLogFailed(1, 'Test error')

      expect(mockPrisma.harvestInvoiceCronLog.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: 'Test error'
        }
      })
    })

    it('should throw error on failure', async () => {
      const error = new Error('Update failed')
      mockPrisma.harvestInvoiceCronLog.update.mockRejectedValue(error)

      await expect(updateHarvestInvoiceCronLogFailed(1, 'Error')).rejects.toThrow('Update failed')
    })
  })

  describe('createHarvestInvoiceErrorCronLog', () => {
    it('should create error cron log entry', async () => {
      mockPrisma.harvestInvoiceCronLog.create.mockResolvedValue({
        id: 2,
        status: 'failed'
      } as any)

      const result = await createHarvestInvoiceErrorCronLog('Test error')

      expect(mockPrisma.harvestInvoiceCronLog.create).toHaveBeenCalledWith({
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errorMessage: 'Test error',
          invoicesFound: 0,
          invoicesCreated: 0,
          invoicesUpdated: 0,
          invoicesFailed: 0,
          errors: []
        }
      })
      expect(result).toBe(2)
    })

    it('should return null on error', async () => {
      mockPrisma.harvestInvoiceCronLog.create.mockRejectedValue(new Error('Database error'))

      const result = await createHarvestInvoiceErrorCronLog('Test error')

      expect(result).toBeNull()
    })
  })
})

