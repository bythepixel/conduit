/**
 * Formats a currency amount with the given currency code
 */
export function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount === null || amount === undefined) return 'N/A'
    const currencyCode = currency || 'USD'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
    }).format(amount)
}

/**
 * Formats a date string to a readable format
 */
export function formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

/**
 * Formats sync results with error handling
 */
export function formatSyncResults(results: {
    created: number
    updated: number
    errors?: string[]
}): string {
    const errorCount = results.errors?.length || 0
    let message = `Sync completed!\nCreated: ${results.created}\nUpdated: ${results.updated}`
    
    if (errorCount > 0) {
        message += `\n\nErrors: ${errorCount}`
        if (errorCount <= 10) {
            message += '\n\n' + results.errors!.join('\n')
        } else {
            message += `\n\nFirst 10 errors:\n${results.errors!.slice(0, 10).join('\n')}\n\n... and ${errorCount - 10} more`
        }
    }
    
    return message
}
