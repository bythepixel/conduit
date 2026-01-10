// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill TextEncoder/TextDecoder for pg library in Jest environment
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables
process.env.SLACK_BOT_TOKEN = 'test-slack-token'
process.env.HUBSPOT_ACCESS_TOKEN = 'test-hubspot-token'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

// Suppress console errors in tests (optional - remove if you want to see them)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Add delay between tests to prevent rate limiting
// This is especially important for API tests that might trigger external services
// Set TEST_DELAY_MS=0 to disable delays (useful for faster local development)
const TEST_DELAY_MS = process.env.TEST_DELAY_MS ? parseInt(process.env.TEST_DELAY_MS, 10) : 50

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Add delay after each test for API-related test suites
afterEach(async () => {
  // Only add delay for API tests (tests in __tests__/api/ or service tests)
  // Skip delay if TEST_DELAY_MS is 0
  if (TEST_DELAY_MS > 0) {
    const testPath = expect.getState().testPath || ''
    if (testPath.includes('/api/') || testPath.includes('/services/')) {
      await delay(TEST_DELAY_MS)
    }
  }
})

