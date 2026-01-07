/**
 * Reusable Prisma select and include objects
 * These constants help maintain consistency across the codebase
 */

export const HUBSPOT_COMPANY_SELECT = {
    id: true,
    name: true,
    btpAbbreviation: true,
} as const

export const HUBSPOT_COMPANY_INCLUDE = {
    hubspotCompany: {
        select: HUBSPOT_COMPANY_SELECT,
    },
} as const



