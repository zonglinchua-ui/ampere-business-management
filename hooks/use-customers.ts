
'use client'

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { useCallback } from 'react'

interface Customer {
  id: string
  customerNumber?: string
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
  customerType: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  xeroContactId?: string | null
  isXeroSynced: boolean
  lastXeroSync?: string | null
  _count?: {
    Project: number
    CustomerInvoice: number
    LegacyInvoice: number
  }
}

interface CustomersResponse {
  customers: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface UseCustomersOptions {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  order?: 'asc' | 'desc'
  includeStats?: boolean
  enabled?: boolean
}

/**
 * Fetch customers from API
 */
async function fetchCustomers(options: UseCustomersOptions = {}): Promise<CustomersResponse> {
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

  const response = await fetch(`/api/customers?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch customers')
  }

  return response.json()
}

/**
 * Custom hook to fetch customers with caching and optimistic updates
 */
export function useCustomers(options: UseCustomersOptions = {}) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['customers', options],
    queryFn: () => fetchCustomers(options),
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
      queryKey: ['customers', { ...options, page: nextPage }],
      queryFn: () => fetchCustomers({ ...options, page: nextPage }),
    })
  }, [options, queryClient])

  /**
   * Prefetch previous page
   */
  const prefetchPreviousPage = useCallback(async () => {
    const previousPage = Math.max((options.page || 1) - 1, 1)
    if (previousPage >= 1) {
      await queryClient.prefetchQuery({
        queryKey: ['customers', { ...options, page: previousPage }],
        queryFn: () => fetchCustomers({ ...options, page: previousPage }),
      })
    }
  }, [options, queryClient])

  /**
   * Invalidate customers cache (trigger refetch)
   */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }, [queryClient])

  /**
   * Update customer in cache optimistically
   */
  const updateCustomerInCache = useCallback((customerId: string, updates: Partial<Customer>) => {
    queryClient.setQueryData<CustomersResponse>(
      ['customers', options],
      (old) => {
        if (!old) return old
        return {
          ...old,
          customers: old.customers.map((customer) =>
            customer.id === customerId ? { ...customer, ...updates } : customer
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
    updateCustomerInCache,
  }
}

/**
 * Hook to fetch a single customer
 */
export function useCustomer(customerId: string, options?: Omit<UseQueryOptions<Customer>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch customer')
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  })
}
