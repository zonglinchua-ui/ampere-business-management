
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { SortRule } from '@/components/contacts/directory-table'

interface FetchParams {
  page: number
  pageSize: number
  search?: string
  sortRules: SortRule[]
}

interface ApiResponse<T> {
  data: T[]
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export function useDirectoryData<T>(
  endpoint: string,
  params: FetchParams,
  queryKey: string
) {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<ApiResponse<T>>({
    queryKey: [queryKey, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: params.page.toString(),
        pageSize: params.pageSize.toString(),
        ...(params.search && { search: params.search }),
        ...(params.sortRules.length > 0 && { 
          sort: JSON.stringify(params.sortRules) 
        }),
      })

      const response = await fetch(`${endpoint}?${searchParams}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${queryKey}`)
      }
      return response.json()
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  })

  // Prefetch next page
  useEffect(() => {
    if (data && data.page < data.totalPages) {
      const nextPageParams = { ...params, page: params.page + 1 }
      
      queryClient.prefetchQuery({
        queryKey: [queryKey, nextPageParams],
        queryFn: async () => {
          const searchParams = new URLSearchParams({
            page: nextPageParams.page.toString(),
            pageSize: nextPageParams.pageSize.toString(),
            ...(nextPageParams.search && { search: nextPageParams.search }),
            ...(nextPageParams.sortRules.length > 0 && { 
              sort: JSON.stringify(nextPageParams.sortRules) 
            }),
          })

          const response = await fetch(`${endpoint}?${searchParams}`)
          if (!response.ok) {
            throw new Error(`Failed to prefetch ${queryKey}`)
          }
          return response.json()
        },
      })
    }
  }, [data, params, queryClient, endpoint, queryKey])

  return {
    data: data?.data || [],
    pagination: {
      page: data?.page || 1,
      pageSize: data?.pageSize || params.pageSize,
      totalRecords: data?.totalRecords || 0,
      totalPages: data?.totalPages || 1,
    },
    isLoading,
    error,
    refetch,
  }
}
