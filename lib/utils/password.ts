import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { BCRYPT_ROUNDS, TEMP_PASSWORD_PREFIX } from '../constants'

/**
 * Generates a cryptographically secure random password
 */
export function generateTempPassword(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Hashes a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Compares a plain text password with a hashed password
 */
export async function comparePassword(
    plainPassword: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
}








