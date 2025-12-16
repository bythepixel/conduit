import { validateMethod } from '../../../lib/utils/methodValidator'
import { createMockRequest, createMockResponse } from '../../utils/testHelpers'

describe('methodValidator', () => {
  describe('validateMethod', () => {
    it('should return true for allowed method', () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()
      const allowedMethods = ['GET', 'POST']
      
      const result = validateMethod(req as any, res, allowedMethods)
      
      expect(result).toBe(true)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should return false and send 405 for disallowed method', () => {
      const req = createMockRequest('DELETE')
      const res = createMockResponse()
      const allowedMethods = ['GET', 'POST']
      
      const result = validateMethod(req as any, res, allowedMethods)
      
      expect(result).toBe(false)
      expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET', 'POST'])
      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.end).toHaveBeenCalledWith('Method DELETE Not Allowed')
    })

    it('should handle undefined method', () => {
      const req = createMockRequest(undefined as any)
      req.method = undefined
      const res = createMockResponse()
      const allowedMethods = ['GET', 'POST']
      
      const result = validateMethod(req as any, res, allowedMethods)
      
      expect(result).toBe(false)
      expect(res.status).toHaveBeenCalledWith(405)
    })
  })
})

