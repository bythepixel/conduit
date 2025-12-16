import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'

// Mocks must be defined before importing modules
jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/utils/password', () => ({
  hashPassword: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

import handler from '../../../pages/api/users/index'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { hashPassword } from '../../../lib/utils/password'

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>

describe('/api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  describe('GET', () => {
    it('should return list of users', async () => {
      const mockUsers = [
        { id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', slackId: null, isAdmin: false, createdAt: new Date() },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as any)
      
      const req = createMockRequest('GET')
      const res = createMockResponse()
      
      await handler(req as any, res)
      
      expect(mockPrisma.user.findMany).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockUsers)
    })
  })

  describe('POST', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        slackId: null,
        isAdmin: false,
      }
      
      const hashedPassword = 'hashed-password'
      const createdUser = {
        id: 1,
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      mockHashPassword.mockResolvedValue(hashedPassword)
      mockPrisma.user.create.mockResolvedValue(createdUser as any)
      
      const req = createMockRequest('POST', userData)
      const res = createMockResponse()
      
      await handler(req as any, res)
      
      expect(mockHashPassword).toHaveBeenCalledWith('password123')
      expect(mockPrisma.user.create).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should return 400 when email and slackId are both missing', async () => {
      const userData = {
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      }
      
      const req = createMockRequest('POST', userData)
      const res = createMockResponse()
      
      await handler(req as any, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Email or Slack ID is required' })
    })
  })
})

