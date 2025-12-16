import { NextApiRequest, NextApiResponse } from 'next'
import { Session } from 'next-auth'

/**
 * Creates a mock NextApiRequest for testing
 */
export function createMockRequest(
  method: string = 'GET',
  body?: any,
  query?: any,
  headers?: any
): Partial<NextApiRequest> {
  return {
    method,
    body,
    query: query || {},
    headers: headers || {},
  } as NextApiRequest
}

/**
 * Creates a mock NextApiResponse for testing
 */
export function createMockResponse(): NextApiResponse {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse

  return res
}

/**
 * Creates a mock session for testing
 */
export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  } as Session
}

/**
 * Helper to wait for async operations in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

