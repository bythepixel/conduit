import handler from '../../../pages/api/harvest-invoices/sync-deals'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { requireAuth } from '../../../lib/middleware/auth'
import { validateMethod } from '../../../lib/utils/methodValidator'
import { syncDealFromHarvestInvoice } from '../../../lib/services/hubspot/hubspotService'

jest.mock('../../../lib/middleware/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../../lib/utils/methodValidator', () => ({
  validateMethod: jest.fn(),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

jest.mock('../../../lib/services/hubspot/hubspotService', () => ({
  syncDealFromHarvestInvoice: jest.fn(),
}))

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockValidateMethod = validateMethod as jest.MockedFunction<typeof validateMethod>
const mockSyncDeal = syncDealFromHarvestInvoice as jest.MockedFunction<typeof syncDealFromHarvestInvoice>

describe('/api/harvest-invoices/sync-deals', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue(createMockSession() as any)
    mockValidateMethod.mockReturnValue(true)
  })

  afterEach(async () => {
    await delayBetweenTests(50)
  })

  it('should require authentication', async () => {
    mockRequireAuth.mockResolvedValue(null as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.harvestInvoice.findMany).not.toHaveBeenCalled()
    expect(mockSyncDeal).not.toHaveBeenCalled()
  })

  it('should sync deals for invoices with hubspotDealId', async () => {
    mockPrisma.harvestInvoice.findMany.mockResolvedValue([
      { id: 1, state: 'open', hubspotDealId: 'deal-1', dealPaidSynced: false },
      { id: 2, state: 'paid', hubspotDealId: 'deal-2', dealPaidSynced: false },
    ] as any)

    mockSyncDeal.mockResolvedValue({ dealId: 'deal-x', companyId: 'company-x' } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockPrisma.harvestInvoice.findMany).toHaveBeenCalled()
    expect(mockSyncDeal).toHaveBeenCalledTimes(2)
    expect(mockSyncDeal).toHaveBeenNthCalledWith(1, 1)
    expect(mockSyncDeal).toHaveBeenNthCalledWith(2, 2)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('should skip invoices that are paid and dealPaidSynced', async () => {
    mockPrisma.harvestInvoice.findMany.mockResolvedValue([
      { id: 1, state: 'paid', hubspotDealId: 'deal-1', dealPaidSynced: true },
      { id: 2, state: 'open', hubspotDealId: 'deal-2', dealPaidSynced: false },
    ] as any)

    mockSyncDeal.mockResolvedValue({ dealId: 'deal-x', companyId: 'company-x' } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSyncDeal).toHaveBeenCalledTimes(1)
    expect(mockSyncDeal).toHaveBeenCalledWith(2)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          totalWithDeals: 2,
          synced: 1,
          skippedPaidAndDealPaid: 1,
        }),
      })
    )
  })

  it('should NOT skip paid+dealPaidSynced when skipPaidAndDealPaid is false', async () => {
    mockPrisma.harvestInvoice.findMany.mockResolvedValue([
      { id: 1, state: 'paid', hubspotDealId: 'deal-1', dealPaidSynced: true },
      { id: 2, state: 'open', hubspotDealId: 'deal-2', dealPaidSynced: false },
    ] as any)

    mockSyncDeal.mockResolvedValue({ dealId: 'deal-x', companyId: 'company-x' } as any)

    const req = createMockRequest('POST', { skipPaidAndDealPaid: false })
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSyncDeal).toHaveBeenCalledTimes(2)
    expect(mockSyncDeal).toHaveBeenNthCalledWith(1, 1)
    expect(mockSyncDeal).toHaveBeenNthCalledWith(2, 2)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          totalWithDeals: 2,
          synced: 2,
          skippedPaidAndDealPaid: 0,
        }),
      })
    )
  })

  it('should continue syncing even if one invoice fails', async () => {
    mockPrisma.harvestInvoice.findMany.mockResolvedValue([
      { id: 1, state: 'open', hubspotDealId: 'deal-1', dealPaidSynced: false },
      { id: 2, state: 'open', hubspotDealId: 'deal-2', dealPaidSynced: false },
    ] as any)

    mockSyncDeal.mockRejectedValueOnce(new Error('boom'))
    mockSyncDeal.mockResolvedValueOnce({ dealId: 'deal-ok', companyId: 'company-ok' } as any)

    const req = createMockRequest('POST')
    const res = createMockResponse()

    await handler(req as any, res)

    expect(mockSyncDeal).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          synced: 1,
          failed: 1,
          errors: expect.arrayContaining([expect.stringContaining('Invoice 1: boom')]),
        }),
      })
    )
  })
})

