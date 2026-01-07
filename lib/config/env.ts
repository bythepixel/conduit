/**
 * Environment variable validation and configuration
 */

const REQUIRED_ENV_VARS = [
    'SLACK_BOT_TOKEN',
    'HUBSPOT_ACCESS_TOKEN',
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
] as const

const OPTIONAL_ENV_VARS = [
    'FIREFLIES_API_KEY',
    'FIREFLIES_WEBHOOK_SECRET',
    'ALLOWED_ORIGINS',
    'NEXT_PUBLIC_APP_URL',
] as const

/**
 * Validates that all required environment variables are set
 * Throws an error if any are missing
 */
export function validateEnv(): void {
    const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key])
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please check your .env file and ensure all required variables are set.'
        )
    }
}

/**
 * Gets an environment variable or throws an error if not set
 */
export function getRequiredEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`)
    }
    return value
}

/**
 * Gets an environment variable with a default value
 */
export function getEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue
}



