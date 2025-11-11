
/**
 * API Response Normalization Utilities
 * 
 * Provides standardized response formats for all API endpoints
 * to ensure predictable, consistent responses and prevent .map() errors
 */

export interface PaginationMeta {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  pagination?: PaginationMeta
  meta?: Record<string, any>
}

export interface ApiErrorResponse {
  success: false
  error: string
  message?: string
  details?: any
  code?: string
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  options?: {
    message?: string
    pagination?: PaginationMeta
    meta?: Record<string, any>
  }
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(options?.message && { message: options.message }),
    ...(options?.pagination && { pagination: options.pagination }),
    ...(options?.meta && { meta: options.meta }),
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  options?: {
    message?: string
    details?: any
    code?: string
  }
): ApiErrorResponse {
  return {
    success: false,
    error,
    ...(options?.message && { message: options.message }),
    ...(options?.details && { details: options.details }),
    ...(options?.code && { code: options.code }),
  }
}

/**
 * Create a standardized paginated list response
 * Ensures data is always an array, never null/undefined
 */
export function createPaginatedResponse<T>(
  data: T[] | null | undefined,
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
  },
  options?: {
    message?: string
    meta?: Record<string, any>
  }
): ApiSuccessResponse<T[]> {
  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : []
  
  return {
    success: true,
    data: safeData,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.totalRecords / pagination.pageSize),
    },
    ...(options?.message && { message: options.message }),
    ...(options?.meta && { meta: options.meta }),
  }
}

/**
 * Create an empty paginated response (for errors or empty results)
 */
export function createEmptyPaginatedResponse<T>(
  page: number = 1,
  pageSize: number = 10
): ApiSuccessResponse<T[]> {
  return {
    success: true,
    data: [],
    pagination: {
      page,
      pageSize,
      totalRecords: 0,
      totalPages: 0,
    },
  }
}

/**
 * Ensure array fields are always arrays (never null/undefined)
 */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

/**
 * Safe pagination parameter parsing
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number
  pageSize: number
  skip: number
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(1000, parseInt(searchParams.get('pageSize') || '10')))
  const skip = (page - 1) * pageSize
  
  return { page, pageSize, skip }
}

/**
 * Legacy format converters for backward compatibility
 */
export namespace LegacyFormats {
  /**
   * Convert to legacy customers/suppliers format
   * { data: [], page, pageSize, totalRecords, totalPages }
   */
  export function toDataFormat<T>(response: ApiSuccessResponse<T[]>): {
    data: T[]
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  } {
    return {
      data: response.data,
      page: response.pagination?.page || 1,
      pageSize: response.pagination?.pageSize || 10,
      totalRecords: response.pagination?.totalRecords || 0,
      totalPages: response.pagination?.totalPages || 0,
    }
  }

  /**
   * Convert to legacy projects format
   * { projects: [], pagination: { page, limit, total, totalPages } }
   */
  export function toProjectsFormat<T>(response: ApiSuccessResponse<T[]>): {
    projects: T[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  } {
    return {
      projects: response.data,
      pagination: {
        page: response.pagination?.page || 1,
        limit: response.pagination?.pageSize || 10,
        total: response.pagination?.totalRecords || 0,
        totalPages: response.pagination?.totalPages || 0,
      },
    }
  }

  /**
   * Convert to legacy payments format
   * { payments: [], pagination: { ... } }
   */
  export function toPaymentsFormat<T>(response: ApiSuccessResponse<T[]>): {
    payments: T[]
    pagination: {
      page: number
      pageSize: number
      totalCount: number
      totalPages: number
    }
  } {
    return {
      payments: response.data,
      pagination: {
        page: response.pagination?.page || 1,
        pageSize: response.pagination?.pageSize || 100,
        totalCount: response.pagination?.totalRecords || 0,
        totalPages: response.pagination?.totalPages || 0,
      },
    }
  }
}
