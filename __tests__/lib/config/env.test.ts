import { validateEnv, getRequiredEnv, getEnv } from '../../../lib/config/env'

describe('env utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateEnv', () => {
    it('should not throw when all required env vars are set', () => {
      process.env.SLACK_BOT_TOKEN = 'token'
      process.env.HUBSPOT_ACCESS_TOKEN = 'token'
      process.env.OPENAI_API_KEY = 'key'
      process.env.DATABASE_URL = 'url'
      process.env.NEXTAUTH_SECRET = 'secret'
      
      expect(() => validateEnv()).not.toThrow()
    })

    it('should throw when required env vars are missing', () => {
      delete process.env.SLACK_BOT_TOKEN
      
      expect(() => validateEnv()).toThrow('Missing required environment variables')
    })
  })

  describe('getRequiredEnv', () => {
    it('should return env var value when set', () => {
      process.env.TEST_VAR = 'test-value'
      
      const result = getRequiredEnv('TEST_VAR')
      
      expect(result).toBe('test-value')
    })

    it('should throw when env var is not set', () => {
      delete process.env.TEST_VAR
      
      expect(() => getRequiredEnv('TEST_VAR')).toThrow('Required environment variable TEST_VAR is not set')
    })
  })

  describe('getEnv', () => {
    it('should return env var value when set', () => {
      process.env.TEST_VAR = 'test-value'
      
      const result = getEnv('TEST_VAR', 'default')
      
      expect(result).toBe('test-value')
    })

    it('should return default when env var is not set', () => {
      delete process.env.TEST_VAR
      
      const result = getEnv('TEST_VAR', 'default-value')
      
      expect(result).toBe('default-value')
    })
  })
})





