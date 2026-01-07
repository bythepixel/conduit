import { prisma } from '../../prisma'

/**
 * Creates a map of Slack user IDs to full names from the database
 */
export async function getUserMap(): Promise<Map<string, string>> {
    console.log(`[Database] Fetching users with Slack IDs`)
    const dbUsers = await prisma.user.findMany({
        where: {
            slackId: { not: null }
        },
        select: {
            slackId: true,
            firstName: true,
            lastName: true
        }
    })

    const userMap = new Map<string, string>()
    dbUsers.forEach(user => {
        if (user.slackId) {
            const fullName = `${user.firstName} ${user.lastName}`.trim()
            userMap.set(user.slackId, fullName)
        }
    })
    
    console.log(`[Database] Loaded ${userMap.size} users from database`)
    return userMap
}

/**
 * Replaces Slack user IDs in message text with names from the user map
 */
export function replaceUserIdsInText(
    text: string,
    userMap: Map<string, string>
): string {
    // Replace <@USER_ID> mentions with names
    return text.replace(/<@([A-Z0-9]+)>/g, (match: string, mentionedUserId: string) => {
        const mentionedName = userMap.get(mentionedUserId) || mentionedUserId
        return `@${mentionedName}`
    })
}

/**
 * Formats Slack messages into a text string with user names
 */
export function formatMessagesForSummary(
    messages: Array<{ user?: string; text?: string }>,
    userMap: Map<string, string>
): string {
    return messages
        .slice()
        .reverse()
        .map((m) => {
            const userId = m.user || 'Unknown'
            const userName = userMap.get(userId) || userId
            const text = m.text || ''
            const processedText = replaceUserIdsInText(text, userMap)
            return `${userName}: ${processedText}`
        })
        .join('\n')
}







