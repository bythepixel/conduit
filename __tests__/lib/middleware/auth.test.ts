import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'

// Mock next-auth before importing anything that uses it
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../pages/api/auth/[...nextauth]', () => ({
  authOptions: {},
}))

import { requireAuth } from '../../../lib/middleware/auth'
import { getServerSession } from 'next-auth/next'

describe('auth middleware', () => {
  const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('requireAuth', () => {
    it('should return session when authenticated', async () => {
      const session = createMockSession()
      mockGetServerSession.mockResolvedValue(session as any)
      
      const req = createMockRequest()
      const res = createMockResponse()
      
      const result = await requireAuth(req as any, res)
      
      expect(result).toEqual(session)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should return null and send 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const req = createMockRequest()
      const res = createMockResponse()
      
      const result = await requireAuth(req as any, res)
      
      expect(result).toBeNull()
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })
  })
})

