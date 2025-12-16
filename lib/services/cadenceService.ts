import { Cadence } from '@prisma/client'

export interface CadenceFilterResult {
    shouldSync: boolean
    cadences: Cadence[]
    dayOfWeek: number
    dayOfMonth: number
    lastDayOfMonth: number
}

/**
 * Determines which cadences should sync based on the current date
 */
export function getCadencesForToday(): CadenceFilterResult {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const dayOfMonth = now.getDate()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    
    const cadences: Cadence[] = []
    
    // Daily: sync on weekdays (Monday-Friday, day 1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        cadences.push('daily')
    }
    
    // Weekly: sync on Fridays (day 5)
    if (dayOfWeek === 5) {
        cadences.push('weekly')
    }
    
    // Monthly: sync on last day of month
    if (dayOfMonth === lastDayOfMonth) {
        cadences.push('monthly')
    }
    
    return {
        shouldSync: cadences.length > 0,
        cadences,
        dayOfWeek,
        dayOfMonth,
        lastDayOfMonth
    }
}

