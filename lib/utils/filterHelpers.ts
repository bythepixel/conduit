/**
 * Creates a search filter for items based on multiple fields
 */
export function createSearchFilter<T>(
    items: T[],
    search: string,
    searchFields: (item: T) => string[]
): T[] {
    if (!search.trim()) return items
    
    const searchLower = search.toLowerCase()
    return items.filter(item => {
        const fieldValues = searchFields(item)
        return fieldValues.some(field => 
            field?.toLowerCase().includes(searchLower)
        )
    })
}

/**
 * Filters items by a boolean condition
 */
export function filterByCondition<T>(
    items: T[],
    condition: (item: T) => boolean
): T[] {
    return items.filter(condition)
}

/**
 * Combines multiple filters
 */
export function combineFilters<T>(
    items: T[],
    ...filters: ((item: T) => boolean)[]
): T[] {
    return items.filter(item => filters.every(filter => filter(item)))
}
