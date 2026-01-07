import { getCadencesForToday } from '../../../lib/services/core/cadenceService'

// Mock Date to control what "today" is
const mockDate = (dateString: string) => {
  const date = new Date(dateString)
  const OriginalDate = global.Date
  
  // Mock Date constructor
  global.Date = jest.fn((...args: any[]) => {
    if (args.length === 0) {
      return date
    }
    return new OriginalDate(...args)
  }) as any
  
  // Copy static methods
  Object.setPrototypeOf(global.Date, OriginalDate)
  global.Date.now = jest.fn(() => date.getTime())
  global.Date.parse = OriginalDate.parse
  global.Date.UTC = OriginalDate.UTC
  global.Date.prototype = OriginalDate.prototype
}

describe('cadenceService', () => {
  const OriginalDate = global.Date

  beforeEach(() => {
    global.Date = OriginalDate
  })

  afterEach(() => {
    global.Date = OriginalDate
    jest.restoreAllMocks()
  })

  describe('getCadencesForToday', () => {
    it('should return daily cadence on weekdays (Monday)', () => {
      mockDate('2024-01-15T10:00:00Z') // Monday
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('daily')
      expect(result.cadences).not.toContain('weekly')
      expect(result.cadences).not.toContain('monthly')
    })

    it('should return daily and weekly cadence on Friday', () => {
      mockDate('2024-01-19T10:00:00Z') // Friday
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('daily')
      expect(result.cadences).toContain('weekly')
      expect(result.cadences).not.toContain('monthly')
    })

    it('should return monthly cadence on last day of month', () => {
      mockDate('2024-01-31T10:00:00Z') // Last day of January
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('monthly')
    })

    it('should return daily, weekly, and monthly on Friday that is also last day of month', () => {
      // January 31, 2024 is actually a Wednesday, so let's use a date that is actually Friday and last day
      // February 29, 2024 (leap year) is a Thursday, so let's use March 29, 2024 which is a Friday
      // Actually, let's find a real Friday that's the last day: May 31, 2024 is a Friday
      mockDate('2024-05-31T10:00:00Z') // Friday, last day of month
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('daily')
      expect(result.cadences).toContain('weekly')
      expect(result.cadences).toContain('monthly')
    })

    it('should not sync on weekends (Saturday)', () => {
      mockDate('2024-01-20T10:00:00Z') // Saturday
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(false)
      expect(result.cadences).toHaveLength(0)
    })

    it('should not sync on weekends (Sunday)', () => {
      mockDate('2024-01-21T10:00:00Z') // Sunday
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(false)
      expect(result.cadences).toHaveLength(0)
    })

    it('should correctly calculate last day of month for February (non-leap year)', () => {
      mockDate('2024-02-29T10:00:00Z') // Last day of February (leap year)
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('monthly')
      expect(result.dayOfMonth).toBe(29)
      expect(result.lastDayOfMonth).toBe(29)
    })

    it('should correctly calculate last day of month for February (non-leap year)', () => {
      mockDate('2023-02-28T10:00:00Z') // Last day of February (non-leap year)
      const result = getCadencesForToday()
      
      expect(result.shouldSync).toBe(true)
      expect(result.cadences).toContain('monthly')
      expect(result.dayOfMonth).toBe(28)
      expect(result.lastDayOfMonth).toBe(28)
    })
  })
})

