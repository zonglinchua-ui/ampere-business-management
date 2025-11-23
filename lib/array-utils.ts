/**
 * Utility functions for safe array operations
 * Prevents .map() runtime errors by ensuring data is always an array
 */

/**
 * Ensures the input is always an array
 * @param data - Potentially an array, null, undefined, or other type
 * @param context - Context for logging (e.g., component name and prop name)
 * @returns An array (empty if input was not an array)
 */
export function ensureArray<T>(data: unknown, context?: string): T[] {
  if (Array.isArray(data)) {
    return data as T[]
  }
  
  // Log warning in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.warn(
      `[Array Safety] Expected array but received ${typeof data}${context ? ` in ${context}` : ''}`,
      data
    )
  }
  
  return []
}

/**
 * Safely maps over data that may not be an array
 * @param data - Potentially an array
 * @param mapFn - Mapping function
 * @param context - Context for logging
 * @returns Mapped array or empty array
 */
export function safeMap<T, U>(
  data: unknown,
  mapFn: (item: T, index: number, array: T[]) => U,
  context?: string
): U[] {
  const arr = ensureArray<T>(data, context)
  return arr.map(mapFn)
}

/**
 * Safely filters data that may not be an array
 * @param data - Potentially an array
 * @param filterFn - Filter function
 * @param context - Context for logging
 * @returns Filtered array or empty array
 */
export function safeFilter<T>(
  data: unknown,
  filterFn: (item: T, index: number, array: T[]) => boolean,
  context?: string
): T[] {
  const arr = ensureArray<T>(data, context)
  return arr.filter(filterFn)
}

/**
 * Safely gets array length
 * @param data - Potentially an array
 * @returns Length of array or 0
 */
export function safeLength(data: unknown): number {
  return Array.isArray(data) ? data.length : 0
}
