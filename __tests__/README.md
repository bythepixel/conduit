# Test Suite Documentation

This directory contains the test suite for the Slacky Hub application.

## Test Structure

```
__tests__/
├── api/                    # API route integration tests
│   └── users/
│       └── index.test.ts
├── components/             # React component tests
│   └── Header.test.tsx
├── lib/                    # Unit tests for library code
│   ├── config/
│   │   └── env.test.ts
│   ├── middleware/
│   │   └── auth.test.ts
│   ├── services/
│   │   ├── cadenceService.test.ts
│   │   └── userMappingService.test.ts
│   └── utils/
│       ├── errorHandler.test.ts
│       ├── methodValidator.test.ts
│       └── password.test.ts
└── utils/                 # Test utilities and mocks
    ├── mocks.ts
    └── testHelpers.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Categories

### Unit Tests
- **Services**: Test individual service functions in isolation
- **Utilities**: Test helper functions and utilities
- **Middleware**: Test authentication and validation middleware

### Integration Tests
- **API Routes**: Test API endpoints with mocked dependencies
- Test request/response handling, error cases, and edge cases

### Component Tests
- **React Components**: Test component rendering and user interactions
- Uses React Testing Library for user-centric testing

## Test Utilities

### `testHelpers.ts`
Provides helper functions for creating mock requests, responses, and sessions.

### `mocks.ts`
Contains mock implementations for external services:
- Prisma Client
- Slack WebClient
- HubSpot Client
- OpenAI API

## Writing New Tests

### Example: Service Test
```typescript
import { myServiceFunction } from '../../../lib/services/myService'

describe('myService', () => {
  it('should do something', () => {
    const result = myServiceFunction(input)
    expect(result).toBe(expected)
  })
})
```

### Example: API Route Test
```typescript
import handler from '../../../pages/api/my-route'
import { createMockRequest, createMockResponse } from '../utils/testHelpers'

describe('/api/my-route', () => {
  it('should handle GET request', async () => {
    const req = createMockRequest('GET')
    const res = createMockResponse()
    
    await handler(req as any, res)
    
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
```

## Coverage Goals

- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%
- **Statements**: 60%

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Mocking**: Mock external dependencies (APIs, database, etc.)
3. **Clear Names**: Use descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Structure tests with clear sections
5. **Edge Cases**: Test both happy paths and error cases

## Continuous Integration

Tests should be run automatically in CI/CD pipelines before deployment.





