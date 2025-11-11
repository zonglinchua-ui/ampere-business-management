
'use client'

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { useCallback } from 'react'

interface Supplier {
  id: string
  supplierNumber?: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country: string
  postalCode?: string | null
  contactPerson?: string | null
  companyReg?: string | null
  website?: string | null
  notes?: string | null
  supplierType: string
  paymentTerms: string
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt: string
  xeroContactId?: string | null
  isXeroSynced: boolean
  lastXeroSync?: string | null
  User_SupplierInvoices_createdByIdToUser?: {
    id: string
    firstName?: string
    lastName?: string
    email: string
  }
}

interface SuppliersResponse {
  suppliers: Supplier[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface UseSuppliersOptions {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  order?: 'asc' | 'desc'
  includeStats?: boolean
  enabled?: boolean
}

/**
 * Fetch suppliers from API
 */
async function fetchSuppliers(options: UseSuppliersOptions = {}): Promise<SuppliersResponse> {
  const {
    page = 1,
    limit = 50,
    search = '',
    sortBy = 'createdAt',
    order = 'desc',
    includeStats = false,
  } = options

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    order,
    ...(search && { search }),
    ...(includeStats && { includeStats: 'true' }),
  })

  const response = await fetch(`/api/suppliers?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch suppliers')
  }

  return response.json()
}

/**
 * Custom hook to fetch suppliers with caching and optimistic updates
 */
export function useSuppliers(options: UseSuppliersOptions = {}) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['suppliers', options],
    queryFn: () => fetchSuppliers(options),
    enabled: options.enabled !== false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  /**
   * Prefetch next page
   */
  const prefetchNextPage = useCallback(async () => {
    const nextPage = (options.page || 1) + 1
    await queryClient.prefetchQuery({
      queryKey: ['suppliers', { ...options, page: nextPage }],
      queryFn: () => fetchSuppliers({ ...options, page: nextPage }),
    })
  }, [options, queryClient])

  /**
   * Prefetch previous page
   */
  const prefetchPreviousPage = useCallback(async () => {
    const previousPage = Math.max((options.page || 1) - 1, 1)
    if (previousPage >= 1) {
      await queryClient.prefetchQuery({
        queryKey: ['suppliers', { ...options, page: previousPage }],
        queryFn: () => fetchSuppliers({ ...options, page: previousPage }),
      })
    }
  }, [options, queryClient])

  /**
   * Invalidate suppliers cache (trigger refetch)
   */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  }, [queryClient])

  /**
   * Update supplier in cache optimistically
   */
  const updateSupplierInCache = useCallback((supplierId: string, updates: Partial<Supplier>) => {
    queryClient.setQueryData<SuppliersResponse>(
      ['suppliers', options],
      (old) => {
        if (!old) return old
        return {
          ...old,
          suppliers: old.suppliers.map((supplier) =>
            supplier.id === supplierId ? { ...supplier, ...updates } : supplier
          ),
        }
      }
    )
  }, [options, queryClient])

  return {
    ...query,
    prefetchNextPage,
    prefetchPreviousPage,
    invalidate,
    updateSupplierInCache,
  }
}

/**
 * Hook to fetch a single supplier
 */
export function useSupplier(supplierId: string, options?: Omit<UseQueryOptions<Supplier>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: async () => {
      const response = await fetch(`/api/suppliers/${supplierId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch supplier')
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  })
}
