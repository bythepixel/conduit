import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireAuth } from '../../../../lib/middleware/auth'
import { validateMethod } from '../../../../lib/utils/methodValidator'
import { handleError } from '../../../../lib/utils/errorHandler'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const session = await requireAuth(req, res)
    if (!session) return

    if (!validateMethod(req, res, ['POST'])) return

    try {
        const harvestAccountId = process.env.HARVEST_ACCOUNT_ID
        const harvestAccessToken = process.env.HARVEST_ACCESS_TOKEN

        if (!harvestAccountId || !harvestAccessToken) {
            return res.status(400).json({
                error: 'Harvest API credentials not configured',
                message: 'Please set HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN environment variables'
            })
        }

        const { id } = req.query
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Invoice ID is required' })
        }

        // Get the invoice from database to find the harvestId
        const invoice = await prisma.harvestInvoice.findUnique({
            where: { id: parseInt(id) }
        })

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        // Fetch the specific invoice from Harvest API
        const response = await fetch(
            `https://api.harvestapp.com/v2/invoices/${invoice.harvestId}`,
            {
                headers: {
                    'Authorization': `Bearer ${harvestAccessToken}`,
                    'Harvest-Account-ID': harvestAccountId,
                    'Content-Type': 'application/json'
                }
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            const errorCode = response.status
            
            if (errorCode === 429) {
                return res.status(429).json({ 
                    error: 'Harvest API Rate Limit Error. Please try again later.',
                    details: { code: errorCode, message: errorText }
                })
            }

            return res.status(errorCode).json({ 
                error: `Harvest API Error: ${errorText}`,
                details: { code: errorCode }
            })
        }

        const invoiceData = await response.json()
        const invoiceFromHarvest = invoiceData

        // Parse dates
        const issueDate = invoiceFromHarvest.issue_date ? new Date(invoiceFromHarvest.issue_date) : null
        const dueDate = invoiceFromHarvest.due_date ? new Date(invoiceFromHarvest.due_date) : null
        const paidDate = invoiceFromHarvest.paid_date ? new Date(invoiceFromHarvest.paid_date) : null

        // Parse amounts (Harvest returns as strings)
        const parseDecimal = (value: any): number | null => {
            if (value === null || value === undefined) return null
            const parsed = typeof value === 'string' ? parseFloat(value) : value
            return isNaN(parsed) ? null : parsed
        }

        const updateData: any = {
            clientId: invoiceFromHarvest.client?.id?.toString() || undefined,
            clientName: invoiceFromHarvest.client?.name || undefined,
            number: invoiceFromHarvest.number || undefined,
            purchaseOrder: invoiceFromHarvest.purchase_order || undefined,
            amount: parseDecimal(invoiceFromHarvest.amount),
            dueAmount: parseDecimal(invoiceFromHarvest.due_amount),
            tax: parseDecimal(invoiceFromHarvest.tax),
            taxAmount: parseDecimal(invoiceFromHarvest.tax_amount),
            discount: parseDecimal(invoiceFromHarvest.discount),
            discountAmount: parseDecimal(invoiceFromHarvest.discount_amount),
            subject: invoiceFromHarvest.subject || undefined,
            notes: invoiceFromHarvest.notes || undefined,
            currency: invoiceFromHarvest.currency || undefined,
            state: invoiceFromHarvest.state || undefined,
            issueDate: issueDate || undefined,
            dueDate: dueDate || undefined,
            paidDate: paidDate || undefined,
            paymentTerm: invoiceFromHarvest.payment_term || undefined,
            metadata: invoiceFromHarvest.metadata ? JSON.parse(JSON.stringify(invoiceFromHarvest.metadata)) : undefined
        }
        
        // Remove undefined values to avoid Prisma errors
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key]
            }
        })

        // Update the invoice
        await prisma.harvestInvoice.update({
            where: { id: invoice.id },
            data: updateData
        })

        return res.status(200).json({
            message: 'Invoice synced successfully',
            invoice: await prisma.harvestInvoice.findUnique({
                where: { id: invoice.id }
            })
        })
    } catch (error: any) {
        console.error('Error syncing invoice from Harvest:', error)
        handleError(error, res)
    }
}

