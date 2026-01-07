import { WebClient } from '@slack/web-api'
import { getRequiredEnv } from '../../config/env'

let slackClient: WebClient | null = null

/**
 * Gets or creates the Slack WebClient instance
 */
function getSlackClient(): WebClient {
    if (!slackClient) {
        const token = getRequiredEnv('SLACK_BOT_TOKEN')
        slackClient = new WebClient(token)
    }
    return slackClient
}

export interface SlackMessage {
    user?: string
    text?: string
    [key: string]: any
}

export interface SlackHistory {
    messages?: SlackMessage[]
    [key: string]: any
}

/**
 * Fetches conversation history from Slack for a given channel
 * Automatically joins the channel if the bot is not a member
 */
export async function fetchChannelHistory(
    channelId: string,
    oldestTimestamp?: number
): Promise<SlackHistory> {
    const oldest = oldestTimestamp 
        ? (oldestTimestamp / 1000).toString() 
        : undefined

    try {
        console.log(`[Slack API] Fetching conversation history for channel ${channelId}`)
        const slack = getSlackClient()
        const history = await slack.conversations.history({
            channel: channelId,
            ...(oldest && { oldest }),
        })
        console.log(`[Slack API] Successfully fetched ${history.messages?.length || 0} messages`)
        return history
    } catch (err: any) {
        const errorCode = err.data?.error || err.code
        const errorMsg = err.data?.error || err.message || 'Unknown error'
        
        // Handle rate limiting
        if (errorCode === 'rate_limited' || err.status === 429 || errorMsg.includes('rate limit')) {
            console.error(`[Slack API] Rate limit error: ${errorMsg}`, err)
            throw new Error(`Slack API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
        }
        
        // Handle not_in_channel error - auto-join and retry
        if (err.data?.error === 'not_in_channel') {
            try {
                console.log(`[Slack API] Bot not in channel ${channelId}, attempting to join...`)
                const slack = getSlackClient()
                await slack.conversations.join({ channel: channelId })

                // Retry fetch after joining
                console.log(`[Slack API] Retrying conversation history fetch after join`)
                const history = await slack.conversations.history({
                    channel: channelId,
                    ...(oldest && { oldest }),
                })
                return history
            } catch (joinErr: any) {
                const joinErrorCode = joinErr.data?.error || joinErr.code
                const joinErrorMsg = joinErr.data?.error || joinErr.message || 'Unknown error'
                
                if (joinErrorCode === 'rate_limited' || joinErr.status === 429 || joinErrorMsg.includes('rate limit')) {
                    console.error(`[Slack API] Rate limit error during join: ${joinErrorMsg}`, joinErr)
                    throw new Error(`Slack API Rate Limit Error (Auto-Join): ${joinErrorMsg}. Will retry automatically.`)
                }
                
                console.error(`[Slack API] Auto-Join Failed:`, joinErr)
                throw new Error(`Slack API Error (Auto-Join Failed): ${joinErrorMsg}`)
            }
        }
        
        // Other errors
        console.error(`[Slack API] Error fetching conversation history:`, err)
        throw new Error(`Slack API Error: ${errorMsg}`)
    }
}

/**
 * Gets messages from the last N days
 */
export async function fetchRecentMessages(
    channelId: string,
    daysAgo: number = 1
): Promise<SlackHistory> {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - daysAgo)
    return fetchChannelHistory(channelId, yesterday.getTime())
}

