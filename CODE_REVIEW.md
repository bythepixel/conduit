# Code Review - Slacky Hub

## Executive Summary

This codebase shows good structure with recent refactoring into services, but there are several opportunities for improvement in terms of DRY principles, error handling consistency, type safety, and code organization.

---

## 🔴 Critical Issues

### 1. **Prisma Client Logging in Production**
**Location:** `lib/prisma.ts:8`
```typescript
log: ['query'],  // This should be conditional
```
**Issue:** Query logging should not be enabled in production as it impacts performance and may log sensitive data.
**Fix:** Make logging conditional based on environment:
```typescript
log: process.env.NODE_ENV === 'development' ? ['query'] : [],
```

### 2. **Type Safety Issues with @ts-ignore**
**Locations:** 
- `pages/api/users/index.ts:43`
- `pages/api/users/[id].ts:20, 56`
- `pages/api/auth/[...nextauth].ts:51`

**Issue:** Using `@ts-ignore` bypasses TypeScript's type checking, which can hide bugs.
**Fix:** Properly type the session/user objects or use type assertions with proper types.

### 3. **Incorrect Mapping Count Query**
**Location:** `pages/api/slack-channels/[id].ts:21`
```typescript
where: { slackChannelId: Number(id) }  // Wrong field name
```
**Issue:** The `Mapping` model doesn't have a `slackChannelId` field - it uses a pivot table `MappingSlackChannel`.
**Fix:** Query through the pivot table:
```typescript
const mappingCount = await prisma.mappingSlackChannel.count({
    where: { slackChannelId: Number(id) }
})
```

---

## 🟡 High Priority Issues

### 4. **DRY Violation: Authentication Middleware**
**Locations:** Every API route file
**Issue:** The same authentication check is repeated in every API route:
```typescript
const session = await getServerSession(req, res, authOptions)
if (!session) {
    return res.status(401).json({ error: "Unauthorized" })
}
```

**Fix:** Create a reusable middleware:
```typescript
// lib/middleware/auth.ts
export async function requireAuth(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<Session | null> {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        res.status(401).json({ error: "Unauthorized" })
        return null
    }
    return session
}
```

### 5. **DRY Violation: Error Handling**
**Locations:** All API routes
**Issue:** Similar error handling patterns repeated across files:
- Prisma error code checking (P2002, P2025, etc.)
- Error response formatting
- Status code selection

**Fix:** Create centralized error handler:
```typescript
// lib/utils/errorHandler.ts
export function handlePrismaError(error: any, res: NextApiResponse) {
    if (error.code === 'P2002') {
        return res.status(400).json({ error: "Duplicate entry" })
    }
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Record not found" })
    }
    // ... other error codes
    return res.status(500).json({ error: error.message })
}
```

### 6. **DRY Violation: Method Validation**
**Locations:** All API routes
**Issue:** Method validation and 405 responses are duplicated:
```typescript
res.setHeader('Allow', ['GET', 'POST'])
return res.status(405).end(`Method ${req.method} Not Allowed`)
```

**Fix:** Create a method validator utility:
```typescript
// lib/utils/methodValidator.ts
export function validateMethod(
    req: NextApiRequest,
    res: NextApiResponse,
    allowedMethods: string[]
): boolean {
    if (!allowedMethods.includes(req.method || '')) {
        res.setHeader('Allow', allowedMethods)
        res.status(405).end(`Method ${req.method} Not Allowed`)
        return false
    }
    return true
}
```

### 7. **Inconsistent Validation**
**Locations:** Multiple API routes
**Issue:** Validation logic is inconsistent:
- Some routes validate required fields, others don't
- Some use early returns, others use try-catch
- Validation error messages vary in format

**Fix:** Create validation utilities or use a schema validation library like Zod:
```typescript
// lib/validators/mappingValidator.ts
import { z } from 'zod'

export const createMappingSchema = z.object({
    channelIds: z.array(z.number()).min(1),
    companyId: z.number(),
    title: z.string().optional(),
    cadence: z.enum(['daily', 'weekly', 'monthly']).default('daily')
})
```

### 8. **Missing Input Sanitization**
**Locations:** All POST/PUT endpoints
**Issue:** No input sanitization or validation beyond basic checks.
**Fix:** Add input validation and sanitization for all user inputs.

### 9. **Hardcoded Magic Numbers**
**Locations:** 
- `pages/api/users/sync.ts:118` - bcrypt rounds
- `pages/api/users/index.ts:31` - bcrypt rounds
- `pages/api/users/[id].ts:48` - bcrypt rounds

**Issue:** Magic numbers should be constants.
**Fix:**
```typescript
const BCRYPT_ROUNDS = 10
const TEMP_PASSWORD_PREFIX = 'temp-password-'
```

### 10. **Inconsistent Cadence Validation**
**Locations:** 
- `pages/api/mappings/index.ts:61`
- `pages/api/mappings/[id].ts:70`

**Issue:** Cadence validation is duplicated and uses hardcoded array.
**Fix:** Extract to constant or use Prisma enum:
```typescript
// lib/constants/cadence.ts
import { Cadence } from '@prisma/client'
export const VALID_CADENCES: Cadence[] = ['daily', 'weekly', 'monthly']
```

---

## 🟢 Medium Priority Issues

### 11. **Service Initialization at Module Level**
**Locations:**
- `lib/services/slackService.ts:3`
- `lib/services/hubspotService.ts:3`
- `lib/services/openaiService.ts:5-7`

**Issue:** Services are initialized at module load time, making testing difficult and potentially causing issues if env vars aren't set.
**Fix:** Use lazy initialization or factory pattern:
```typescript
let slackClient: WebClient | null = null

export function getSlackClient(): WebClient {
    if (!slackClient) {
        slackClient = new WebClient(process.env.SLACK_BOT_TOKEN)
    }
    return slackClient
}
```

### 12. **Missing Environment Variable Validation**
**Locations:** Service files
**Issue:** No validation that required environment variables exist before use.
**Fix:** Add startup validation:
```typescript
// lib/config/env.ts
export function validateEnv() {
    const required = ['SLACK_BOT_TOKEN', 'HUBSPOT_ACCESS_TOKEN', 'OPENAI_API_KEY']
    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`)
    }
}
```

### 13. **Inconsistent Error Messages**
**Locations:** Throughout codebase
**Issue:** Error messages vary in format and detail level.
**Fix:** Standardize error message format and create error message constants.

### 14. **Missing Transaction Support**
**Locations:** 
- `pages/api/mappings/index.ts:65-84`
- `pages/api/mappings/[id].ts:74-95`

**Issue:** Multiple database operations that should be atomic are not wrapped in transactions.
**Fix:** Use Prisma transactions:
```typescript
await prisma.$transaction(async (tx) => {
    const mapping = await tx.mapping.create({...})
    await tx.mappingSlackChannel.createMany({...})
    return mapping
})
```

### 15. **No Rate Limiting**
**Locations:** All API routes
**Issue:** No rate limiting on API endpoints, making them vulnerable to abuse.
**Fix:** Add rate limiting middleware or use a service like Upstash Redis.

### 16. **Password Security**
**Locations:** 
- `pages/api/users/sync.ts:118, 140`
- `pages/api/users/index.ts:31`

**Issue:** Temporary passwords use timestamp, which is predictable.
**Fix:** Use cryptographically secure random strings:
```typescript
import crypto from 'crypto'
const tempPassword = crypto.randomBytes(32).toString('hex')
```

### 17. **Missing Pagination**
**Locations:** All GET endpoints
**Issue:** No pagination for list endpoints, could cause performance issues with large datasets.
**Fix:** Add pagination support:
```typescript
const page = Number(req.query.page) || 1
const limit = Number(req.query.limit) || 20
const skip = (page - 1) * limit
```

### 18. **No Request Logging/Monitoring**
**Locations:** All API routes
**Issue:** No structured logging or monitoring for API requests.
**Fix:** Add request logging middleware and integrate with monitoring service.

### 19. **Inconsistent Date Handling**
**Locations:** Throughout codebase
**Issue:** Mix of Date objects and string timestamps.
**Fix:** Standardize on ISO strings or Date objects consistently.

### 20. **Missing API Documentation**
**Issue:** No API documentation (OpenAPI/Swagger).
**Fix:** Add API documentation using tools like Swagger or tRPC.

---

## 🔵 Low Priority / Code Quality

### 21. **Type Definitions Duplication**
**Locations:** 
- `pages/index.tsx:5-29`
- Potentially other components

**Issue:** Type definitions are duplicated across files instead of being shared.
**Fix:** Create shared type definitions:
```typescript
// lib/types/index.ts
export type Mapping = {
    id: number
    title?: string
    // ...
}
```

### 22. **Component Organization**
**Location:** `pages/index.tsx`
**Issue:** Large component file (482 lines) with mixed concerns.
**Fix:** Break into smaller components:
- `MappingList.tsx`
- `MappingForm.tsx`
- `SyncButton.tsx`

### 23. **Missing Loading States**
**Locations:** Some API calls
**Issue:** Not all async operations show loading states.
**Fix:** Ensure all async operations have proper loading indicators.

### 24. **Console.log in Production Code**
**Locations:** Throughout services
**Issue:** Using `console.log` instead of proper logging.
**Fix:** Use a logging library (e.g., Winston, Pino) with log levels.

### 25. **Magic Strings**
**Locations:** Throughout codebase
**Issue:** Hardcoded strings that should be constants:
- Error messages
- API error codes
- Status strings

**Fix:** Extract to constants file.

### 26. **Missing JSDoc Comments**
**Locations:** Service functions
**Issue:** Some functions lack documentation.
**Fix:** Add JSDoc comments to all public functions.

### 27. **Inconsistent Naming Conventions**
**Locations:** Throughout codebase
**Issue:** Mix of camelCase and inconsistent naming.
**Fix:** Establish and enforce naming conventions.

### 28. **No Unit Tests**
**Issue:** No test files found in codebase.
**Fix:** Add unit tests for services and utilities.

### 29. **No Integration Tests**
**Issue:** No API integration tests.
**Fix:** Add integration tests for API routes.

### 30. **Missing Error Boundaries**
**Location:** React components
**Issue:** No error boundaries in React app.
**Fix:** Add error boundaries to catch React errors.

---

## 📋 Recommendations Summary

### Immediate Actions (Critical)
1. Fix Prisma client logging for production
2. Fix incorrect mapping count query in slack-channels/[id].ts
3. Remove all `@ts-ignore` and properly type code
4. Add environment variable validation

### Short Term (High Priority)
1. Create authentication middleware
2. Create centralized error handler
3. Add input validation with Zod
4. Extract magic numbers to constants
5. Add transaction support for multi-step operations

### Medium Term (Medium Priority)
1. Add rate limiting
2. Improve password security
3. Add pagination to list endpoints
4. Standardize error messages
5. Add structured logging

### Long Term (Low Priority)
1. Break down large components
2. Add comprehensive test coverage
3. Add API documentation
4. Create shared type definitions
5. Add monitoring and observability

---

## 🎯 Code Quality Metrics

- **Lines of Code:** ~3,000+
- **Duplication:** High (authentication, error handling, validation)
- **Type Safety:** Medium (some `@ts-ignore` usage)
- **Test Coverage:** 0%
- **Documentation:** Low
- **Error Handling:** Inconsistent
- **Security:** Medium (needs rate limiting, input validation)

---

## 📝 Additional Notes

### Positive Aspects
- Good recent refactoring into service modules
- Clear separation of concerns in services
- Good use of Prisma for database operations
- Modern Next.js patterns
- Good UI/UX with Tailwind CSS

### Areas for Improvement
- Reduce code duplication
- Improve type safety
- Add comprehensive error handling
- Add testing infrastructure
- Improve security posture
- Add monitoring and observability

