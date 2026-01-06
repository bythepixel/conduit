# DRY Analysis & Organizational Improvements

## Executive Summary

This analysis identifies code duplication and organizational improvements using DRY (Don't Repeat Yourself) principles. The codebase has several areas where patterns are repeated that could be abstracted into reusable utilities.

---

## 🔴 Critical Issues

### 1. **Inconsistent Authentication Pattern**

**Problem**: Two different authentication patterns are used across API endpoints:
- Pattern A: Direct `getServerSession` with manual check (13 endpoints)
- Pattern B: `requireAuth` middleware (12 endpoints)

**Examples**:
```typescript
// Pattern A (meeting-notes/index.ts, link.ts, sync-to-hubspot.ts, etc.)
const session = await getServerSession(req, res, authOptions)
if (!session) {
    return res.status(401).json({ error: "Unauthorized" })
}

// Pattern B (users/index.ts, sync.ts, etc.)
const session = await requireAuth(req, res)
if (!session) return
```

**Impact**: 
- Inconsistent error messages ("Unauthorized" vs ERROR_MESSAGES.UNAUTHORIZED)
- More code duplication
- Harder to maintain

**Recommendation**: Standardize on `requireAuth` middleware for all endpoints.

**Files Affected**:
- `pages/api/meeting-notes/index.ts`
- `pages/api/meeting-notes/[id]/link.ts`
- `pages/api/meeting-notes/[id]/sync-to-hubspot.ts`
- `pages/api/meeting-notes/[id]/fetch.ts`
- `pages/api/hubspot-companies/index.ts`
- `pages/api/hubspot-companies/[id].ts`
- `pages/api/hubspot-companies/generate-abbreviations.ts`
- `pages/api/hubspot-companies/clear-abbreviations.ts`
- `pages/api/slack-channels/index.ts`
- `pages/api/slack-channels/[id].ts`
- `pages/api/prompts/index.ts`
- `pages/api/prompts/[id].ts`
- `pages/api/prompts/[id]/activate.ts`

---

### 2. **Inconsistent Method Validation**

**Problem**: Method validation is done in two ways:
- Using `validateMethod` utility (some endpoints)
- Manual validation with `res.setHeader` and `res.status(405)` (14 endpoints)

**Examples**:
```typescript
// Pattern A: Using utility
if (!validateMethod(req, res, ['POST'])) return

// Pattern B: Manual (repeated 14 times)
if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
}
```

**Recommendation**: Use `validateMethod` consistently across all endpoints.

**Files Affected**: Same as authentication issue above.

---

### 3. **Repeated HubSpot Company Select Pattern**

**Problem**: The same `hubspotCompany` select pattern is repeated in multiple files:

```typescript
// Repeated in 4+ places
include: {
    hubspotCompany: {
        select: {
            id: true,
            name: true,
            btpAbbreviation: true
        }
    }
}
```

**Files**:
- `pages/api/meeting-notes/index.ts`
- `pages/api/meeting-notes/[id]/link.ts`
- `pages/api/meeting-notes/[id]/sync-to-hubspot.ts`
- `pages/api/meeting-notes/[id]/fetch.ts`

**Recommendation**: Create a constant or helper function:
```typescript
// lib/constants/selects.ts
export const HUBSPOT_COMPANY_SELECT = {
    id: true,
    name: true,
    btpAbbreviation: true
} as const

export const HUBSPOT_COMPANY_INCLUDE = {
    hubspotCompany: {
        select: HUBSPOT_COMPANY_SELECT
    }
} as const
```

---

### 4. **Inconsistent Error Handling**

**Problem**: Error handling patterns vary:
- Some use try/catch with `console.error` and manual response
- Some use `handleError` utility
- Error response formats differ

**Examples**:
```typescript
// Pattern A: Manual error handling
catch (error: any) {
    console.error('[Endpoint] Error:', error)
    return res.status(500).json({
        error: 'Failed to...',
        details: error.message
    })
}

// Pattern B: Using utility (inconsistent format)
catch (error: any) {
    handleError(error, res)
}
```

**Recommendation**: 
1. Create a standardized error handler wrapper
2. Use consistent error response format
3. Consider structured logging

---

### 5. **Repeated ID Parsing Pattern**

**Problem**: ID parsing and validation is repeated across dynamic route handlers:

```typescript
// Repeated pattern
const { id } = req.query
if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid ID' })
}
const parsedId = parseInt(id)
if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid ID format' })
}
```

**Recommendation**: Create a utility function:
```typescript
// lib/utils/requestHelpers.ts
export function parseIdParam(
    id: string | string[] | undefined,
    res: NextApiResponse
): number | null {
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Missing or invalid ID parameter' })
        return null
    }
    const parsed = parseInt(id, 10)
    if (isNaN(parsed)) {
        res.status(400).json({ error: 'Invalid ID format' })
        return null
    }
    return parsed
}
```

---

## 🟡 Medium Priority Issues

### 6. **Repeated Prisma Error Code Handling**

**Problem**: Prisma error code handling (P2002, P2025) is repeated in multiple endpoints:

```typescript
// Repeated in hubspot-companies/index.ts, [id].ts, etc.
catch (e: any) {
    if (e.code === 'P2002') {
        if (e.meta?.target?.includes('btpAbbreviation')) {
            return res.status(400).json({ error: "BTP Abbreviation already exists" })
        }
        return res.status(400).json({ error: "Company ID already exists" })
    }
    if (e.code === 'P2025') {
        return res.status(404).json({ error: "Company not found" })
    }
    return res.status(500).json({ error: e.message })
}
```

**Recommendation**: Enhance `handlePrismaError` to handle these specific cases or create domain-specific error handlers.

---

### 7. **Inconsistent Response Formatting**

**Problem**: Success responses use different formats:
- Some: `{ message: '...', data: ... }`
- Some: `{ success: true, message: '...', note: ... }`
- Some: Direct data return

**Recommendation**: Standardize response format or create response helpers.

---

### 8. **Repeated Rate Limit Error Handling**

**Problem**: HubSpot rate limit error handling is duplicated:

```typescript
// Repeated in hubspotService.ts and hubspot-companies/sync.ts
if (errorCode === 429 || 
    errorMsg.toLowerCase().includes('rate limit') || 
    errorMsg.toLowerCase().includes('too many requests')) {
    // Handle rate limit
}
```

**Recommendation**: Extract to a utility function in `hubspotService.ts` or create a general rate limit handler.

---

## 🟢 Low Priority / Organizational

### 9. **API Route Organization**

**Current Structure**:
```
pages/api/
  ├── meeting-notes/
  │   ├── index.ts
  │   ├── sync.ts
  │   └── [id]/
  │       ├── fetch.ts
  │       ├── link.ts
  │       └── sync-to-hubspot.ts
```

**Observation**: Good organization, but could benefit from:
- Shared types file for meeting notes
- Shared validation schemas

---

### 10. **Service Layer Organization**

**Current**: Services are well-organized in `lib/services/`

**Suggestion**: Consider grouping related services:
- `lib/services/hubspot/` (hubspotService, sync functions)
- `lib/services/fireflies/` (firefliesService)
- `lib/services/slack/` (slackService, userMappingService)

---

## 📋 Implementation Priority

### Phase 1 (High Impact, Low Effort)
1. ✅ Standardize on `requireAuth` (13 files)
2. ✅ Standardize on `validateMethod` (14 files)
3. ✅ Create HubSpot company select constant (4 files)

### Phase 2 (Medium Impact, Medium Effort)
4. ✅ Create ID parsing utility
5. ✅ Enhance Prisma error handling
6. ✅ Standardize error response format

### Phase 3 (Lower Priority)
7. ✅ Extract rate limit handling
8. ✅ Reorganize service layer
9. ✅ Add shared types/validation

---

## 🛠️ Recommended Utilities to Create

### 1. `lib/utils/apiHelpers.ts`
```typescript
export function parseIdParam(id: string | string[] | undefined, res: NextApiResponse): number | null
export function createSuccessResponse(data: any, message?: string)
export function createErrorResponse(error: string, details?: any, statusCode?: number)
```

### 2. `lib/constants/selects.ts`
```typescript
export const HUBSPOT_COMPANY_SELECT = { ... }
export const HUBSPOT_COMPANY_INCLUDE = { ... }
```

### 3. `lib/utils/hubspotErrorHandler.ts`
```typescript
export function handleHubSpotError(error: any): { isRateLimit: boolean, message: string }
```

### 4. Enhanced `lib/utils/errorHandler.ts`
- Add domain-specific error handlers
- Standardize error response format
- Add structured logging support

---

## 📊 Metrics

- **Duplicated Code Blocks**: ~15-20 instances
- **Files Needing Refactoring**: ~25 files
- **Estimated LOC Reduction**: ~200-300 lines
- **Maintainability Improvement**: High
- **Consistency Improvement**: High

---

## ✅ Benefits of Refactoring

1. **Consistency**: All endpoints behave the same way
2. **Maintainability**: Changes in one place affect all endpoints
3. **Testability**: Easier to test shared utilities
4. **Readability**: Less boilerplate in endpoint handlers
5. **Bug Prevention**: Centralized logic reduces chance of errors

