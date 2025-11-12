/**
 * Xero Token Middleware
 * Automatically ensures tokens are fresh before any Xero API operation
 * This prevents the "Allow access" popup by keeping tokens always valid
 */

import { ensureXeroTokensFresh } from './xero-auto-refresh'

/**
 * Wraps any async function that makes Xero API calls
 * Automatically refreshes tokens before execution if needed
 * 
 * Usage:
 * const result = await withFreshTokens(async () => {
 *   // Your Xero API call here
 *   return await someXeroOperation()
 * })
 */
export async function withFreshTokens<T>(
  operation: () => Promise<T>,
  minValidityMinutes: number = 20
): Promise<T> {
  // Ensure tokens are fresh before operation
  const tokensFresh = await ensureXeroTokensFresh(minValidityMinutes)

  if (!tokensFresh) {
    throw new Error('Failed to refresh Xero tokens. Please reconnect to Xero.')
  }

  // Execute the operation with fresh tokens
  return await operation()
}

/**
 * Decorator for class methods that make Xero API calls
 * Automatically refreshes tokens before method execution
 * 
 * Usage:
 * class MyService {
 *   @withTokenRefresh
 *   async myXeroOperation() {
 *     // Your Xero API call here
 *   }
 * }
 */
export function withTokenRefresh(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: any[]) {
    // Ensure tokens are fresh
    const tokensFresh = await ensureXeroTokensFresh(20)

    if (!tokensFresh) {
      throw new Error('Failed to refresh Xero tokens. Please reconnect to Xero.')
    }

    // Call original method
    return await originalMethod.apply(this, args)
  }

  return descriptor
}

/**
 * Check if we need to show reconnect UI to the user
 * Returns true if tokens cannot be refreshed and manual reconnection is needed
 */
export async function needsManualReconnect(): Promise<boolean> {
  try {
    const tokensFresh = await ensureXeroTokensFresh(20)
    return !tokensFresh
  } catch (error) {
    return true
  }
}

