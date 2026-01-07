import { prisma } from '../../prisma'
import { CadenceFilterResult } from './cadenceService'

/**
 * Builds the where clause for mapping queries
 */
export function buildMappingWhereClause(
    mappingId?: number,
    cadenceResult?: CadenceFilterResult
): any {
    let whereClause: any = mappingId ? { id: Number(mappingId) } : {}
    
    // If this is a cron call, filter by cadence based on current date
    if (cadenceResult) {
        whereClause.cadence = { in: cadenceResult.cadences }
        console.log(`[MAPPING SERVICE] Filtering mappings by cadence: ${cadenceResult.cadences.join(', ')} (Day: ${cadenceResult.dayOfWeek}, Date: ${cadenceResult.dayOfMonth}/${cadenceResult.lastDayOfMonth})`)
    }
    
    return whereClause
}

/**
 * Fetches mappings for sync with all required relations
 */
export async function fetchMappingsForSync(
    mappingId?: number,
    cadenceResult?: CadenceFilterResult
) {
    const whereClause = buildMappingWhereClause(mappingId, cadenceResult)
    
    const mappings = await prisma.slackMapping.findMany({ 
        where: whereClause,
        include: {
            slackChannels: {
                include: {
                    slackChannel: true
                }
            },
            hubspotCompany: true
        }
    })
    
    console.log(`[MAPPING SERVICE] Found ${mappings.length} mapping(s) to sync`)
    return mappings
}



