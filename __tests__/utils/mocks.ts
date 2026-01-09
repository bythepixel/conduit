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
  slackMapping: {
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
    findFirst: jest.fn(),
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
  cronLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  cronLogMapping: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  meetingNote: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  fireHookLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  harvestInvoice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  harvestCompany: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  harvestCompanyMapping: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  harvestInvoiceCronLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  harvestInvoiceCronLogInvoice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
}

// Mock Slack WebClient
export const mockSlackClient = {
  conversations: {
    history: jest.fn(),
    join: jest.fn(),
    list: jest.fn(),
  },
  users: {
    list: jest.fn(),
  },
}

// Reset function for mocks
export function resetMocks() {
  mockSlackClient.conversations.history.mockReset()
  mockSlackClient.conversations.join.mockReset()
  mockSlackClient.conversations.list.mockReset()
  mockSlackClient.users.list.mockReset()
  mockHubSpotClient.crm.objects.notes.basicApi.create.mockReset()
  mockHubSpotClient.crm.companies.basicApi.getPage.mockReset()
  mockOpenAIClient.createChatCompletion.mockReset()
  
  // Reset Prisma mocks
  Object.values(mockPrisma).forEach((model: any) => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach((method: any) => {
        if (typeof method === 'function' && method.mockReset) {
          method.mockReset()
        }
      })
    }
  })
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
    companies: {
      basicApi: {
        getPage: jest.fn(),
      },
    },
    deals: {
      basicApi: {
        create: jest.fn(),
        update: jest.fn(),
        getById: jest.fn(),
      },
    },
  },
}

// Mock OpenAI API
export const mockOpenAIClient = {
  createChatCompletion: jest.fn(),
}

