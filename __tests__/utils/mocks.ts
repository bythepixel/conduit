/**
 * Mock implementations for external services
 */

// Mock Prisma Client
export const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  mapping: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  slackChannel: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  hubspotCompany: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  mappingSlackChannel: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  prompt: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
}

// Mock Slack WebClient
export const mockSlackClient = {
  conversations: {
    history: jest.fn(),
    join: jest.fn(),
  },
  users: {
    list: jest.fn(),
  },
}

// Reset function for mocks
export function resetMocks() {
  mockSlackClient.conversations.history.mockReset()
  mockSlackClient.conversations.join.mockReset()
  mockSlackClient.users.list.mockReset()
  mockHubSpotClient.crm.objects.notes.basicApi.create.mockReset()
  mockOpenAIClient.createChatCompletion.mockReset()
}

// Mock HubSpot Client
export const mockHubSpotClient = {
  crm: {
    objects: {
      notes: {
        basicApi: {
          create: jest.fn(),
        },
      },
    },
  },
}

// Mock OpenAI API
export const mockOpenAIClient = {
  createChatCompletion: jest.fn(),
}

