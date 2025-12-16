import handler from '../../../pages/api/users/[id]'
import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { hashPassword } from '../../../lib/utils/password'
import { handleError } from '../../../lib/utils/errorHandler'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/utils/password', () => ({
  hashPassword: jest.fn(),
}))

jest.mock('../../../lib/utils/errorHandler', () => ({
  handleError: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>
const mockHandleError = handleError as jest.MockedFunction<typeof handleError>

describe('/api/users/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  describe('DELETE', () => {
    it('should delete a user', async () => {
      const session = createMockSession({ user: { id: '1' } })
      mockRequireAuth.mockResolvedValue(session as any)

      mockPrisma.user.delete.mockResolvedValue({} as any)

      const req = createMockRequest('DELETE', {}, { id: '2' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 2 },
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('should prevent deleting your own account', async () => {
      const session = createMockSession({ user: { id: '1' } })
      mockRequireAuth.mockResolvedValue(session as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.user.delete).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete your own account',
      })
    })

    it('should handle deletion errors', async () => {
      const session = createMockSession({ user: { id: '1' } })
      mockRequireAuth.mockResolvedValue(session as any)

      const error = { message: 'Database error' }
      mockPrisma.user.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', {}, { id: '2' })
      const res = createMockResponse()

      // DELETE doesn't have try-catch, so error will propagate
      // In real app, this would be caught by Next.js error handler
      await expect(handler(req as any, res)).rejects.toEqual(error)
    })
  })

  describe('PUT', () => {
    it('should update a user without password', async () => {
      const updatedUser = {
        id: 1,
        email: 'updated@example.com',
        firstName: 'Updated',
        lastName: 'User',
        slackId: 'U123',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'old@example.com',
        slackId: null,
      } as any)
      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      const req = createMockRequest('PUT', {
        email: 'updated@example.com',
        firstName: 'Updated',
        lastName: 'User',
        slackId: 'U123',
        isAdmin: false,
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHashPassword).not.toHaveBeenCalled()
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            email: 'updated@example.com',
            firstName: 'Updated',
            lastName: 'User',
            slackId: 'U123',
            isAdmin: false,
          }),
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(updatedUser)
    })

    it('should update a user with password', async () => {
      const hashedPassword = 'hashed-password'
      mockHashPassword.mockResolvedValue(hashedPassword)

      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'old@example.com',
        slackId: null,
      } as any)
      mockPrisma.user.update.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        slackId: null,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = createMockRequest('PUT', {
        email: 'test@example.com',
        password: 'new-password',
        firstName: 'Test',
        lastName: 'User',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHashPassword).toHaveBeenCalledWith('new-password')
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: hashedPassword,
          }),
        })
      )
    })

    it('should require email or slackId if both are missing and user has neither', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: null,
        slackId: null,
      } as any)

      const req = createMockRequest('PUT', {
        firstName: 'Test',
        lastName: 'User',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Email or Slack ID is required',
      })
    })

    it('should allow update if user has existing email or slackId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'existing@example.com',
        slackId: null,
      } as any)
      mockPrisma.user.update.mockResolvedValue({
        id: 1,
        email: 'existing@example.com',
        firstName: 'Updated',
        lastName: 'User',
        slackId: null,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const req = createMockRequest('PUT', {
        firstName: 'Updated',
        lastName: 'User',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle update errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        slackId: null,
      } as any)

      const error = new Error('Update failed')
      mockPrisma.user.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockHandleError).toHaveBeenCalledWith(error, res)
    })
  })
})

