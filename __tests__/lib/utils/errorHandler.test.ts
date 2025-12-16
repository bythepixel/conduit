import { handlePrismaError, handleError } from '../../../lib/utils/errorHandler'
import { createMockResponse } from '../../utils/testHelpers'
import { PRISMA_ERROR_CODES } from '../../../lib/constants'

describe('errorHandler', () => {
  describe('handlePrismaError', () => {
    it('should handle P2002 (unique constraint) error', () => {
      const res = createMockResponse()
      const error = { code: PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT, message: 'Unique constraint failed' }
      
      const result = handlePrismaError(error, res)
      
      expect(result).toBe(true)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Duplicate entry' })
    })

    it('should handle P2025 (record not found) error', () => {
      const res = createMockResponse()
      const error = { code: PRISMA_ERROR_CODES.RECORD_NOT_FOUND, message: 'Record not found' }
      
      const result = handlePrismaError(error, res)
      
      expect(result).toBe(true)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Record not found' })
    })

    it('should return false for unknown Prisma errors', () => {
      const res = createMockResponse()
      const error = { code: 'P1000', message: 'Unknown error' }
      
      const result = handlePrismaError(error, res)
      
      expect(result).toBe(false)
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('handleError', () => {
    it('should handle Prisma errors', () => {
      const res = createMockResponse()
      const error = { code: PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT, message: 'Unique constraint failed' }
      
      handleError(error, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Duplicate entry' })
    })

    it('should handle Prisma client not updated error', () => {
      const res = createMockResponse()
      const error = { message: 'updateMany is not defined' }
      
      handleError(error, res)
      
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prisma client not updated. Please restart your dev server after running: npx prisma generate'
      })
    })

    it('should handle general errors', () => {
      const res = createMockResponse()
      const error = { message: 'Something went wrong' }
      
      handleError(error, res)
      
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' })
    })

    it('should handle errors without message', () => {
      const res = createMockResponse()
      const error = {}
      
      handleError(error, res)
      
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
    })
  })
})

