const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/', 
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/utils/', // Exclude utility files from being treated as tests
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jose|@panva/hkdf|oidc-token-hash|oauth4webapi|@prisma)/)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'pages/api/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // Fail tests if coverage thresholds are not met
  coverageReporters: ['text', 'lcov', 'html'],
  // In CI, fail if tests fail (default behavior, but explicit)
  bail: false,
  // Ensure tests fail on errors
  errorOnDeprecated: true,
  // Increase test timeout for API tests that might need delays
  testTimeout: 10000, // 10 seconds (default is 5 seconds)
  // Run tests with limited concurrency to prevent rate limiting issues
  // Use fewer workers to serialize API tests and prevent rate limiting
  maxWorkers: process.env.CI ? 2 : '50%', // 50% of CPU cores locally, 2 workers in CI
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

