/**
 * Helper utilities specifically for API tests to prevent rate limiting
 */

/**
 * Adds a delay after each test in API test suites
 * Call this in the afterEach hook of API test files
 */
export async function addApiTestDelay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps an async test function with a delay before execution
 * Useful for tests that make multiple API calls
 */
export function withDelay<T extends (...args: any[]) => Promise<any>>(
  testFn: T,
  delayMs: number = 50
): T {
  return (async (...args: any[]) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return testFn(...args)
  }) as T
}

/**
 * Creates a rate-limited version of a function that adds delays between calls
 */
export function rateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number = 100
): T {
  let lastCallTime = 0

  return (async (...args: any[]) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall < delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - timeSinceLastCall))
    }

    lastCallTime = Date.now()
    return fn(...args)
  }) as T
}






