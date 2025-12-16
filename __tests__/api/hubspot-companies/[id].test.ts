import { createMockRequest, createMockResponse, createMockSession } from '../../utils/testHelpers'
import { mockPrisma } from '../../utils/mocks'
import { getServerSession } from 'next-auth/next'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../../pages/api/auth/[...nextauth]', () => ({
  authOptions: {},
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: require('../../utils/mocks').mockPrisma,
}))

import handler from '../../../pages/api/hubspot-companies/[id]'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('/api/hubspot-companies/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(createMockSession() as any)
  })

  describe('DELETE', () => {
    it('should delete a company when not used in mappings', async () => {
      mockPrisma.mapping.count.mockResolvedValue(0)
      mockPrisma.hubspotCompany.delete.mockResolvedValue({} as any)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.mapping.count).toHaveBeenCalledWith({
        where: { hubspotCompanyId: 1 },
      })
      expect(mockPrisma.hubspotCompany.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('should prevent deletion when company is used in mappings', async () => {
      mockPrisma.mapping.count.mockResolvedValue(2)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.delete).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete company. It is used in 2 mapping(s). Please remove the mappings first.',
      })
    })

    it('should handle P2025 error (not found)', async () => {
      mockPrisma.mapping.count.mockResolvedValue(0)

      const error = {
        code: 'P2025',
        message: 'Record not found',
      }

      mockPrisma.hubspotCompany.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company not found',
      })
    })

    it('should handle general deletion errors', async () => {
      mockPrisma.mapping.count.mockResolvedValue(0)

      const error = {
        message: 'Deletion failed',
      }

      mockPrisma.hubspotCompany.delete.mockRejectedValue(error)

      const req = createMockRequest('DELETE', {}, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Deletion failed',
      })
    })
  })

  describe('PUT', () => {
    it('should update a company', async () => {
      const updatedCompany = {
        id: 1,
        companyId: 'company-123',
        name: 'Updated Company',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.hubspotCompany.update.mockResolvedValue(updatedCompany as any)

      const req = createMockRequest('PUT', {
        companyId: 'company-123',
        name: 'Updated Company',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(mockPrisma.hubspotCompany.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          companyId: 'company-123',
          name: 'Updated Company',
        },
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(updatedCompany)
    })

    it('should return 400 when companyId is missing', async () => {
      const req = createMockRequest('PUT', {
        name: 'Company without ID',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'companyId is required',
      })
    })

    it('should handle duplicate companyId error (P2002)', async () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed',
      }

      mockPrisma.hubspotCompany.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        companyId: 'company-123',
        name: 'Test Company',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company ID already exists',
      })
    })

    it('should handle not found error (P2025)', async () => {
      const error = {
        code: 'P2025',
        message: 'Record not found',
      }

      mockPrisma.hubspotCompany.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        companyId: 'company-123',
        name: 'Test Company',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Company not found',
      })
    })

    it('should handle general update errors', async () => {
      const error = {
        message: 'Update failed',
      }

      mockPrisma.hubspotCompany.update.mockRejectedValue(error)

      const req = createMockRequest('PUT', {
        companyId: 'company-123',
        name: 'Test Company',
      }, { id: '1' })
      const res = createMockResponse()

      await handler(req as any, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Update failed',
      })
    })
  })
})

