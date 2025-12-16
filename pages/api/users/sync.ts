import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { WebClient } from '@slack/web-api'
import bcrypt from 'bcryptjs'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }

    try {
        // Fetch all Slack users
        const slackUsersResponse = await slack.users.list()
        const slackUsers = slackUsersResponse.members?.filter(
            (user: any) => !user.deleted && !user.is_bot && user.id !== 'USLACKBOT'
        ) || []

        const results = {
            created: 0,
            updated: 0,
            errors: [] as string[]
        }

        for (const slackUser of slackUsers) {
            try {
                const email = slackUser.profile?.email || null
                const slackId = slackUser.id
                const firstName = slackUser.profile?.first_name || slackUser.real_name?.split(' ')[0] || 'Unknown'
                const lastName = slackUser.profile?.last_name || slackUser.real_name?.split(' ').slice(1).join(' ') || 'User'

                // Require either email or slackId
                if (!email && !slackId) {
                    results.errors.push(`Skipped ${slackUser.name || slackId}: No email or Slack ID`)
                    continue
                }

                // Check if user exists by email or slackId
                const whereClause: any[] = []
                if (email) whereClause.push({ email })
                if (slackId) whereClause.push({ slackId })
                
                const existingUser = whereClause.length > 0 ? await prisma.user.findFirst({
                    where: {
                        OR: whereClause
                    }
                }) : null

                if (existingUser) {
                    // Update existing user - only update fields that have changed
                    const updateData: any = {}
                    
                    // Update name fields if they've changed
                    if (firstName !== existingUser.firstName) {
                        updateData.firstName = firstName
                    }
                    if (lastName !== existingUser.lastName) {
                        updateData.lastName = lastName
                    }
                    
                    // Only update slackId if it's different and not already set, and not taken by another user
                    if (slackId && existingUser.slackId !== slackId) {
                        if (!existingUser.slackId) {
                            // Check if another user has this slackId
                            const slackIdUser = await prisma.user.findUnique({
                                where: { slackId }
                            })
                            if (!slackIdUser) {
                                updateData.slackId = slackId
                            }
                        } else {
                            // Don't change existing slackId
                        }
                    } else if (slackId && !existingUser.slackId) {
                        // Set slackId if it doesn't exist
                        const slackIdUser = await prisma.user.findUnique({
                            where: { slackId }
                        })
                        if (!slackIdUser) {
                            updateData.slackId = slackId
                        }
                    }
                    
                    // Only update email if it's different and not taken by another user
                    if (email && email !== existingUser.email) {
                        const emailUser = await prisma.user.findUnique({
                            where: { email }
                        })
                        if (!emailUser) {
                            updateData.email = email
                        }
                    } else if (!email && existingUser.email) {
                        // Don't remove existing email if Slack user doesn't have one
                    } else if (email && !existingUser.email) {
                        // Set email if user doesn't have one
                        const emailUser = await prisma.user.findUnique({
                            where: { email }
                        })
                        if (!emailUser) {
                            updateData.email = email
                        }
                    }
                    
                    // Only update password if it's empty (don't overwrite existing passwords)
                    if (!existingUser.password) {
                        updateData.password = await bcrypt.hash('temp-password-' + Date.now(), 10)
                    }

                    // Only update if there are changes
                    if (Object.keys(updateData).length > 0) {
                        await prisma.user.update({
                            where: { id: existingUser.id },
                            data: updateData
                        })
                        results.updated++
                    }
                } else {
                    // Check if email or slackId already exists before creating
                    const emailExists = email ? await prisma.user.findUnique({ where: { email } }) : null
                    const slackIdExists = slackId ? await prisma.user.findUnique({ where: { slackId } }) : null
                    
                    if (emailExists || slackIdExists) {
                        results.errors.push(`Skipped ${slackUser.name || slackId}: User already exists with this email or Slack ID`)
                        continue
                    }
                    
                    // Create new user with temporary password
                    const tempPassword = await bcrypt.hash('temp-password-' + Date.now(), 10)
                    try {
                        await prisma.user.create({
                            data: {
                                email: email || null,
                                slackId: slackId || null,
                                firstName,
                                lastName,
                                password: tempPassword,
                                isAdmin: false
                            }
                        })
                        results.created++
                    } catch (createError: any) {
                        if (createError.code === 'P2002') {
                            results.errors.push(`Skipped ${slackUser.name || slackId}: Duplicate entry (email or slackId already exists)`)
                        } else {
                            throw createError
                        }
                    }
                }
            } catch (error: any) {
                const errorMsg = error.code === 'P2002' 
                    ? `Duplicate entry (email or slackId already exists)`
                    : error.message || 'Unknown error'
                results.errors.push(`Error processing ${slackUser.name || slackUser.id}: ${errorMsg}`)
                console.error(`Error processing Slack user ${slackUser.id}:`, error)
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            results
        })
    } catch (error: any) {
        console.error('Error syncing users from Slack:', error)
        return res.status(500).json({ error: error.message || 'Failed to sync users from Slack' })
    }
}

