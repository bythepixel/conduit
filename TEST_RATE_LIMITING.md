# Test Rate Limiting Configuration

## Overview

To prevent rate limiting errors during test execution, we've implemented configurable delays between API tests. This is especially important when tests might trigger external services (even when mocked, some test setups can benefit from delays).

## Configuration

### Environment Variable

Set `TEST_DELAY_MS` to control the delay between API tests:

```bash
# Default: 50ms delay
npm test

# Custom delay: 100ms
TEST_DELAY_MS=100 npm test

# Disable delays (faster, but may cause rate limiting)
TEST_DELAY_MS=0 npm test
```

### Jest Configuration

The test suite is configured with:

- **Test Timeout**: 10 seconds (increased from default 5 seconds)
- **Max Workers**: 
  - Local: 50% of CPU cores (serializes API tests)
  - CI: 2 workers (reduced concurrency)

### Automatic Delays

Delays are automatically added:
- After each test in `__tests__/api/` directories
- After each test in `__tests__/lib/services/` directories
- Only when `TEST_DELAY_MS > 0`

## Implementation Details

### Global Setup (`jest.setup.js`)

- Automatically adds delays after API and service tests
- Configurable via `TEST_DELAY_MS` environment variable
- Default: 50ms (can be disabled with `TEST_DELAY_MS=0`)

### Test-Specific Delays

Some critical API tests have additional delays:

- `__tests__/api/sync.test.ts`: 100ms delay after each test
- `__tests__/api/users/sync.test.ts`: 150ms delay after each test

### Helper Utilities

#### `__tests__/utils/apiTestHelpers.ts`

Provides utilities for rate limiting in tests:

```typescript
// Add delay after test
await addApiTestDelay(100)

// Wrap test function with delay
const delayedTest = withDelay(myTestFunction, 50)

// Rate-limit a function
const rateLimitedFn = rateLimit(myFunction, 100)
```

## Best Practices

### Local Development

For faster local development, you can disable delays:

```bash
TEST_DELAY_MS=0 npm test
```

### CI/CD

For CI/CD pipelines, use moderate delays:

```bash
TEST_DELAY_MS=100 npm test
```

### When Rate Limiting Occurs

If you encounter rate limiting errors:

1. Increase `TEST_DELAY_MS` (try 100-200ms)
2. Reduce `maxWorkers` in `jest.config.js`
3. Run tests serially: `npm test -- --runInBand`

## Performance Impact

- **With delays (50ms)**: ~20-25 seconds for full test suite
- **Without delays (0ms)**: ~2-3 seconds for full test suite
- **Trade-off**: Slower tests but more reliable, prevents rate limiting

## Troubleshooting

### Tests Timing Out

If tests are timing out due to delays:

1. Increase `testTimeout` in `jest.config.js`
2. Reduce `TEST_DELAY_MS`
3. Check for slow-running tests

### Rate Limiting Still Occurring

If rate limiting still occurs despite delays:

1. Verify all external APIs are properly mocked
2. Check for any unmocked API calls in tests
3. Increase delays: `TEST_DELAY_MS=200 npm test`
4. Run tests serially: `npm test -- --runInBand`

## Notes

- All external APIs (Slack, HubSpot, OpenAI) should be mocked in tests
- Delays are primarily a safety measure and for test stability
- Delays only apply to API and service tests, not utility tests
- You can disable delays entirely for faster local development

