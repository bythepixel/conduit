import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({ 
    apiKey: process.env.OPENAI_API_KEY || 'temp-dummy-key' 
})
const openai = new OpenAIApi(configuration)

const DEFAULT_SYSTEM_PROMPT = 'Summarize the following Slack conversation in a short, informative paragraph. The input format is "Name: Message". Use the names in your summary to attribute key points.'

/**
 * Generates a summary of messages using ChatGPT
 */
export async function generateSummary(
    messagesText: string,
    systemPrompt?: string,
    channelName?: string
): Promise<string> {
    const prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT
    
    try {
        console.log(`[OpenAI API] Creating chat completion${channelName ? ` for ${channelName}` : ''}`)
        const completion = await openai.createChatCompletion({
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: messagesText }
            ],
            model: 'gpt-3.5-turbo',
        })
        
        console.log(`[OpenAI API] Successfully generated summary`)
        const summary = completion.data.choices[0].message?.content || ''
        const channelLabel = channelName || 'channel'
        return `Daily Slack Summary for ${channelLabel}:\n\n${summary}`
    } catch (openaiErr: any) {
        const errorCode = openaiErr.response?.status
        const errorMsg = openaiErr.response?.data?.error?.message || openaiErr.message || 'Unknown error'
        
        if (errorCode === 429 || errorMsg.toLowerCase().includes('rate limit')) {
            console.error(`[OpenAI API] Rate limit error: ${errorMsg}`, openaiErr.response?.data)
            throw new Error(`OpenAI API Rate Limit Error: ${errorMsg}. Will retry automatically.`)
        }
        
        console.error(`[OpenAI API] Error creating chat completion:`, openaiErr.response?.data || openaiErr)
        throw new Error(`OpenAI API Error: ${errorMsg}`)
    }
}

/**
 * Generates a fallback summary when OpenAI API fails
 */
export function generateFallbackSummary(
    messages: Array<{ user?: string; text?: string }>,
    errorMsg: string
): string {
    const fallbackLines = messages.map((m) => `- <${m.user || '?'}>: ${m.text || ''}`)
    return `Daily Slack Summary (Fallback): \n\n${fallbackLines.join('\n')}\n\n(OpenAI API Error: ${errorMsg})`
}

