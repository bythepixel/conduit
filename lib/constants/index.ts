/**
 * Application-wide constants
 */

// Password hashing
export const BCRYPT_ROUNDS = 10
export const TEMP_PASSWORD_PREFIX = 'temp-password-'

// Cadence values
// Note: After running npx prisma generate, you can import Cadence from '@prisma/client'
type Cadence = 'daily' | 'weekly' | 'monthly'
export const VALID_CADENCES: Cadence[] = ['daily', 'weekly', 'monthly']
export const DEFAULT_CADENCE: Cadence = 'daily'

// Error messages
export const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Unauthorized',
    NOT_FOUND: 'Record not found',
    DUPLICATE_ENTRY: 'Duplicate entry',
    VALIDATION_ERROR: 'Validation error',
    INTERNAL_ERROR: 'Internal server error',
} as const

// Prisma error codes
export const PRISMA_ERROR_CODES = {
    UNIQUE_CONSTRAINT: 'P2002',
    RECORD_NOT_FOUND: 'P2025',
} as const

