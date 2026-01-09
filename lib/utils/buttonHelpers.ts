/**
 * Gets button classes based on disabled state
 */
export function getButtonClasses(
    isDisabled: boolean,
    enabledClasses: string,
    disabledClasses: string = 'text-slate-500 cursor-not-allowed'
): string {
    return `p-2 rounded-lg transition-colors ${isDisabled ? disabledClasses : enabledClasses}`
}

/**
 * Color classes for action buttons
 */
export const buttonColorClasses = {
    emerald: 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-900/20',
    blue: 'text-blue-400 hover:text-blue-600 hover:bg-blue-900/20',
    green: 'text-green-400 hover:text-green-600 hover:bg-green-900/20',
    yellow: 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-900/20',
    red: 'text-red-400 hover:text-red-600 hover:bg-red-900/20',
    indigo: 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-900/20',
} as const

export type ButtonColor = keyof typeof buttonColorClasses

/**
 * Gets button classes with color
 */
export function getActionButtonClasses(
    isDisabled: boolean,
    color: ButtonColor = 'emerald'
): string {
    const baseClasses = 'p-2 rounded-lg transition-colors'
    if (isDisabled) {
        return `${baseClasses} text-slate-500 cursor-not-allowed`
    }
    return `${baseClasses} ${buttonColorClasses[color]}`
}
