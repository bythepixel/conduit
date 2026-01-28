import handler from '../../pages/api/cron-all'
import { createMockRequest, createMockResponse, createMockSession, delayBetweenTests } from '../utils/testHelpers'

// Mock fetch globally
global.fetch = jest.fn()

describe('/api/cron-all', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    process.env.VERCEL_URL = 'test-app.vercel.app'
  })

  afterEach(async () => {
    await delayBetweenTests(150)
    delete process.env.CRON_SECRET
    delete process.env.VERCEL_URL
  })

  describe('GET requests (cron)', () => {
    it('should run all sync jobs in order', async () => {
      const mockSyncDataResponse = {
        message: 'Data sync completed',
        hubspot: { created: 1, updated: 0 },
        slack: { created: 2, updated: 1 }
      }

      const mockSyncResponse = {
        message: 'Sync process completed',
        results: []
      }

      const mockHarvestResponse = {
        message: 'Sync completed',
        results: { created: 5, updated: 3 }
      }

      const mockGitSpotResponse = {
        message: 'GitSpot release sync completed',
        results: { mappingsProcessed: 1, notesCreated: 2, skipped: 0, errors: [] }
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSyncDataResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSyncResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHarvestResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGitSpotResponse
        })

      const req = createMockRequest('GET', undefined, undefined, {
        'x-vercel-cron': '1'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).toHaveBeenCalledTimes(4)
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/sync-data'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-vercel-cron': '1'
          })
        })
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/sync'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('/api/harvest-invoices/sync'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('/api/gitspot/sync-releases'),
        expect.any(Object)
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle errors gracefully and continue', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Success' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Success' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Sync failed' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Success' })
        })

      const req = createMockRequest('GET', undefined, undefined, {
        'x-vercel-cron': '1'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(207) // Multi-status (some errors)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          results: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.stringContaining('sync failed')
            ])
          })
        })
      )
    })

    it('should validate CRON_SECRET for manual cron calls', async () => {
      const req = createMockRequest('GET', undefined, undefined, {
        authorization: 'Bearer wrong-secret'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('should allow Vercel cron without CRON_SECRET', async () => {
      delete process.env.CRON_SECRET

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Success' })
      })

      const req = createMockRequest('GET', undefined, undefined, {
        'x-vercel-cron': '1'
      })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('POST requests', () => {
    it('should run all sync jobs for manual execution', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Success' })
      })

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(global.fetch).toHaveBeenCalledTimes(4)
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle fetch errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const req = createMockRequest('POST')
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(207)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.objectContaining({
            errors: expect.any(Array)
          })
        })
      )
    })
  })
})

