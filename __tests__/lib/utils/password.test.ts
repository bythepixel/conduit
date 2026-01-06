import { generateTempPassword, hashPassword, comparePassword } from '../../../lib/utils/password'

describe('password utilities', () => {
  describe('generateTempPassword', () => {
    it('should generate a random password', () => {
      const password1 = generateTempPassword()
      const password2 = generateTempPassword()
      
      expect(password1).toBeTruthy()
      expect(password2).toBeTruthy()
      expect(password1).not.toBe(password2)
      expect(password1.length).toBeGreaterThan(0)
    })

    it('should generate passwords of consistent length', () => {
      const passwords = Array.from({ length: 10 }, () => generateTempPassword())
      const lengths = passwords.map(p => p.length)
      const uniqueLengths = new Set(lengths)
      
      // All passwords should have the same length (64 hex characters)
      expect(uniqueLengths.size).toBe(1)
      expect(lengths[0]).toBe(64)
    })
  })

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'test-password'
      const hashed = await hashPassword(password)
      
      expect(hashed).toBeTruthy()
      expect(hashed).not.toBe(password)
      expect(hashed.length).toBeGreaterThan(0)
    })

    it('should produce different hashes for the same password (salt)', async () => {
      const password = 'test-password'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      // Should be different due to salt
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'test-password'
      const hashed = await hashPassword(password)
      const result = await comparePassword(password, hashed)
      
      expect(result).toBe(true)
    })

    it('should return false for non-matching passwords', async () => {
      const password = 'test-password'
      const wrongPassword = 'wrong-password'
      const hashed = await hashPassword(password)
      const result = await comparePassword(wrongPassword, hashed)
      
      expect(result).toBe(false)
    })
  })
})






