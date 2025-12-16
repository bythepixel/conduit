import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma, mockSlackClient } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { generateTempPassword, hashPassword } from '../../../lib/utils/password'
import { getRequiredEnv } from '../../../lib/config/env'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/utils/password', () => ({
  hashPassword: jest.fn(),
  generateTempPassword: jest.fn(),
}))

jest.mock('../../../lib/config/env', () => ({
  getRequiredEnv: jest.fn(() => 'test-token'),
}))

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => {
    const { mockSlackClient } = require('../../utils/mocks')
    return mockSlackClient
  }),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

import handler from '../../../pages/api/users/sync'

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>
const mockGenerateTempPassword = generateTempPassword as jest.MockedFunction<typeof generateTempPassword>

describe('/api/users/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
    mockHashPassword.mockResolvedValue('hashed-password')
    mockGenerateTempPassword.mockReturnValue('temp-password-123')
  })

  afterEach(async () => {
    // Add delay to prevent rate limiting between tests
    await new Promise((resolve) => setTimeout(resolve, 150))
  })

  it('should sync users from Slack successfully', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'john.doe',
          real_name: 'John Doe',
          profile: {
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
          deleted: false,
          is_bot: false,
        },
        {
          id: 'U456',
          name: 'jane.smith',
          real_name: 'Jane Smith',
          profile: {
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 1,
      email: 'john@example.com',
      slackId: 'U123',
    } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSlackClient.users.list).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Sync completed',
        results: expect.objectContaining({
          created: expect.any(Number),
          updated: 0,
          errors: [],
        }),
      })
    )
  })

  it('should filter out deleted users, bots, and USLACKBOT', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          deleted: false,
          is_bot: false,
          profile: { email: 'user@example.com' },
        },
        {
          id: 'U456',
          name: 'deleted',
          deleted: true,
          is_bot: false,
          profile: { email: 'deleted@example.com' },
        },
        {
          id: 'U789',
          name: 'bot',
          deleted: false,
          is_bot: true,
          profile: { email: 'bot@example.com' },
        },
        {
          id: 'USLACKBOT',
          name: 'slackbot',
          deleted: false,
          is_bot: false,
          profile: {},
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    // Should only create user for U123 (the valid user)
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
  })

  it('should update existing user when found by email', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'john.doe',
          real_name: 'John Updated',
          profile: {
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Updated',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    const existingUser = {
      id: 1,
      email: 'john@example.com',
      slackId: null,
      firstName: 'John',
      lastName: 'Doe', // Different from 'Updated'
      password: 'existing-password',
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(existingUser as any)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({} as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          lastName: 'Updated',
          slackId: 'U123',
        }),
      })
    )
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          updated: 1,
        }),
      })
    )
  })

  it('should update existing user when found by slackId', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'john.doe',
          profile: {
            email: 'newemail@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    const existingUser = {
      id: 1,
      email: 'old@example.com',
      slackId: 'U123',
      firstName: 'John',
      lastName: 'Doe',
      password: 'existing-password',
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(existingUser as any)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({} as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('should skip user if no email or slackId', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: '',
          name: 'no-id',
          profile: {},
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          errors: expect.arrayContaining([
            expect.stringContaining('No email or Slack ID'),
          ]),
        }),
      })
    )
  })

  it('should generate temp password for new users', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'new.user',
          profile: {
            email: 'new@example.com',
            first_name: 'New',
            last_name: 'User',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockGenerateTempPassword).toHaveBeenCalled()
    expect(mockHashPassword).toHaveBeenCalledWith('temp-password-123')
  })

  it('should generate temp password for existing user without password', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          profile: {
            email: 'user@example.com',
            first_name: 'User',
            last_name: 'Name',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    const existingUser = {
      id: 1,
      email: 'user@example.com',
      slackId: 'U123',
      firstName: 'User',
      lastName: 'Name',
      password: null, // No password
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(existingUser as any)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({} as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockGenerateTempPassword).toHaveBeenCalled()
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: 'hashed-password',
        }),
      })
    )
  })

  it('should not overwrite existing password', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          profile: {
            email: 'user@example.com',
            first_name: 'User',
            last_name: 'Name',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    const existingUser = {
      id: 1,
      email: 'user@example.com',
      slackId: 'U123',
      firstName: 'User',
      lastName: 'Name',
      password: 'existing-password',
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(existingUser as any)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({} as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    // Since all fields match, update should not be called
    // OR if update is called, password should not be in the update data
    if (mockPrisma.user.update.mock.calls.length > 0) {
      const updateCall = mockPrisma.user.update.mock.calls[0]
      expect(updateCall[0].data).not.toHaveProperty('password')
    } else {
      // No update called because no changes
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    }
  })

  it('should handle duplicate entry errors gracefully', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          profile: {
            email: 'user@example.com',
            first_name: 'User',
            last_name: 'Name',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed',
    })

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          errors: expect.arrayContaining([
            expect.stringContaining('Duplicate entry'),
          ]),
        }),
      })
    )
  })

  it('should handle users with only real_name (no profile names)', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          real_name: 'John Doe',
          profile: {
            email: 'john@example.com',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
      })
    )
  })

  it('should handle users with no name fields', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          profile: {
            email: 'user@example.com',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1 } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Unknown',
          lastName: 'User',
        }),
      })
    )
  })

  it('should not update if no changes detected', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          real_name: 'John Doe',
          profile: {
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    const existingUser = {
      id: 1,
      email: 'john@example.com',
      slackId: 'U123',
      firstName: 'John',
      lastName: 'Doe',
      password: 'existing-password',
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockResolvedValue(existingUser as any)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          updated: 0,
        }),
      })
    )
  })

  it('should handle Slack API errors', async () => {
    mockSlackClient.users.list.mockRejectedValue(new Error('Slack API error'))

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Slack API error',
      })
    )
  })

  it('should handle individual user processing errors', async () => {
    const mockSlackUsers = {
      members: [
        {
          id: 'U123',
          name: 'user',
          profile: {
            email: 'user@example.com',
          },
          deleted: false,
          is_bot: false,
        },
      ],
    }

    mockSlackClient.users.list.mockResolvedValue(mockSlackUsers as any)
    mockPrisma.user.findFirst.mockRejectedValue(new Error('Database error'))

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          errors: expect.arrayContaining([
            expect.stringContaining('Error processing'),
          ]),
        }),
      })
    )
  })
})

