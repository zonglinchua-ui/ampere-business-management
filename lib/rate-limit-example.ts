/**
 * Example: How to apply rate limiting to API routes
 * 
 * This file shows how to protect your API routes with rate limiting.
 * Copy this pattern to your actual API route files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from './rate-limit';

/**
 * Example 1: Strict rate limiting for authentication endpoints
 * Allows only 5 requests per minute
 */
export async function POST_AUTH_EXAMPLE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, {
    maxRequests: 5,
    windowSeconds: 60,
  });
  
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }
  
  // Your actual authentication logic here
  // ...
  
  return NextResponse.json({ success: true });
}

/**
 * Example 2: Moderate rate limiting for general API endpoints
 * Allows 30 requests per minute
 */
export async function GET_API_EXAMPLE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, {
    maxRequests: 30,
    windowSeconds: 60,
  });
  
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }
  
  // Your actual API logic here
  // ...
  
  return NextResponse.json({ data: [] });
}

/**
 * Example 3: Lenient rate limiting for file uploads
 * Allows 10 requests per 5 minutes
 */
export async function POST_UPLOAD_EXAMPLE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, {
    maxRequests: 10,
    windowSeconds: 300, // 5 minutes
  });
  
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }
  
  // Your actual upload logic here
  // ...
  
  return NextResponse.json({ uploaded: true });
}

/**
 * To apply rate limiting to your routes:
 * 
 * 1. Import the rate limit function:
 *    import { applyRateLimit } from '@/lib/rate-limit';
 * 
 * 2. Add rate limiting at the start of your route handler:
 *    const rateLimitResult = await applyRateLimit(request, { maxRequests: 10, windowSeconds: 60 });
 *    if (!rateLimitResult.success) {
 *      return rateLimitResult.response;
 *    }
 * 
 * 3. Continue with your normal route logic
 * 
 * Recommended limits:
 * - Authentication endpoints: 5-10 requests per minute
 * - Read operations (GET): 30-60 requests per minute
 * - Write operations (POST/PUT/DELETE): 10-20 requests per minute
 * - File uploads: 5-10 requests per 5 minutes
 */
