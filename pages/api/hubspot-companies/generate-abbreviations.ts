import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../lib/config/auth"

/**
 * Generates a 2-5 letter abbreviation from a company name
 */
function generateAbbreviation(name: string): string {
    if (!name) return ''
    
    // Remove common suffixes and clean up
    const cleaned = name
        .replace(/\s+(Inc|LLC|Ltd|Corp|Corporation|Company|Co|Group|Partners|Associates|Solutions|Services|Systems|Technologies|Tech)\s*$/i, '')
        .trim()
    
    // Split into words
    const words = cleaned.split(/\s+/).filter(w => w.length > 0)
    
    if (words.length === 0) return ''
    
    // Strategy 1: Use first letters of words (2-5 letters)
    if (words.length >= 2) {
        let abbrev = words.map(w => w[0].toUpperCase()).join('')
        // Limit to 5 characters
        if (abbrev.length > 5) {
            abbrev = abbrev.substring(0, 5)
        }
        // Ensure at least 2 characters
        if (abbrev.length >= 2) {
            return abbrev
        }
    }
    
    // Strategy 2: For single word, use first 2-5 letters
    if (words.length === 1) {
        const word = words[0]
        // Use first 2-5 letters, prioritizing meaningful length
        if (word.length <= 5) {
            return word.toUpperCase()
        } else if (word.length <= 8) {
            // Use first 4 letters for medium-length words
            return word.substring(0, 4).toUpperCase()
        } else {
            // Use first 3-5 letters for long words
            return word.substring(0, Math.min(5, Math.max(3, Math.floor(word.length / 2)))).toUpperCase()
        }
    }
    
    // Fallback: first letter of first word + first 1-4 letters of second word
    if (words.length >= 2) {
        const first = words[0][0].toUpperCase()
        const second = words[1].substring(0, Math.min(4, words[1].length)).toUpperCase()
        return (first + second).substring(0, 5)
    }
    
    return cleaned.substring(0, 5).toUpperCase()
}

/**
 * Generates a unique abbreviation, trying variations if needed
 */
async function generateUniqueAbbreviation(name: string, existingAbbrevs: Set<string>): Promise<string> {
    const baseAbbrev = generateAbbreviation(name)
    
    if (!baseAbbrev) {
        // Fallback: use first 3-5 characters of name
        const fallback = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase()
        if (fallback.length >= 2) {
            return fallback
        }
        return ''
    }
    
    // If base abbreviation is unique, return it
    if (!existingAbbrevs.has(baseAbbrev)) {
        return baseAbbrev
    }
    
    // Try variations: add numbers or modify
    for (let i = 2; i <= 99; i++) {
        const variant = baseAbbrev.substring(0, Math.min(3, baseAbbrev.length)) + i.toString()
        if (variant.length <= 5 && !existingAbbrevs.has(variant)) {
            return variant
        }
    }
    
    // Try shortening
    if (baseAbbrev.length > 2) {
        for (let len = baseAbbrev.length - 1; len >= 2; len--) {
            const shortened = baseAbbrev.substring(0, len)
            if (!existingAbbrevs.has(shortened)) {
                return shortened
            }
        }
    }
    
    // Last resort: use first 2-3 letters + random number
    const prefix = baseAbbrev.substring(0, Math.min(2, baseAbbrev.length))
    for (let i = 1; i <= 999; i++) {
        const variant = prefix + i.toString().padStart(2, '0')
        if (variant.length <= 5 && !existingAbbrevs.has(variant)) {
            return variant
        }
    }
    
    return baseAbbrev // Return original even if not unique (will cause error, but better than nothing)
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    if (!validateMethod(req, res, ['POST'])) return

    try {
        // Get all companies
        const allCompanies = await prisma.hubspotCompany.findMany({
            select: {
                id: true,
                name: true,
                btpAbbreviation: true,
                companyId: true
            }
        })

        // Get all existing abbreviations
        const existingAbbrevs = new Set<string>(
            allCompanies
                .map(c => c.btpAbbreviation)
                .filter((abbrev): abbrev is string => !!abbrev)
        )

        // Find companies without abbreviations
        const companiesToUpdate = allCompanies.filter(c => !c.btpAbbreviation)

        const results = {
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        }

        // Generate and update abbreviations
        for (const company of companiesToUpdate) {
            try {
                const name = company.name || company.companyId
                const abbreviation = await generateUniqueAbbreviation(name, existingAbbrevs)
                
                if (!abbreviation || abbreviation.length < 2) {
                    results.skipped++
                    results.errors.push(`Could not generate abbreviation for ${name}`)
                    continue
                }

                // Update the company
                await prisma.hubspotCompany.update({
                    where: { id: company.id },
                    data: { btpAbbreviation: abbreviation }
                })

                // Add to existing set to avoid duplicates in this batch
                existingAbbrevs.add(abbreviation)
                results.updated++
            } catch (error: any) {
                if (error.code === 'P2002') {
                    // Duplicate abbreviation - try again with different variation
                    try {
                        const name = company.name || company.companyId
                        const abbreviation = await generateUniqueAbbreviation(name, existingAbbrevs)
                        if (abbreviation && abbreviation.length >= 2) {
                            await prisma.hubspotCompany.update({
                                where: { id: company.id },
                                data: { btpAbbreviation: abbreviation }
                            })
                            existingAbbrevs.add(abbreviation)
                            results.updated++
                        } else {
                            results.skipped++
                            results.errors.push(`Could not generate unique abbreviation for ${name}`)
                        }
                    } catch (retryError: any) {
                        results.skipped++
                        results.errors.push(`Error updating ${company.name || company.companyId}: ${retryError.message || 'Unknown error'}`)
                    }
                } else {
                    results.skipped++
                    results.errors.push(`Error updating ${company.name || company.companyId}: ${error.message || 'Unknown error'}`)
                }
            }
        }

        return res.status(200).json({
            message: 'Abbreviation generation completed',
            results
        })
    } catch (error: any) {
        console.error('Error generating abbreviations:', error)
        return res.status(500).json({
            error: error.message || 'Failed to generate abbreviations',
            details: error
        })
    }
}

function validateMethod(req: NextApiRequest, res: NextApiResponse, allowedMethods: string[]): boolean {
    if (!allowedMethods.includes(req.method || '')) {
        res.setHeader('Allow', allowedMethods)
        res.status(405).end(`Method ${req.method} Not Allowed`)
        return false
    }
    return true
}


