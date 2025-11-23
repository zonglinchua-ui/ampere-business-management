import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validate request body against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or error response
 * 
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *   const validation = validateRequest(createUserSchema, body);
 *   
 *   if (!validation.success) {
 *     return validation.error;
 *   }
 *   
 *   const data = validation.data; // Type-safe validated data
 *   // ... proceed with validated data
 * }
 * ```
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      ),
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate query parameters against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param searchParams - URL search params
 * @returns Validation result with parsed data or error response
 */
export function validateQueryParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const params = Object.fromEntries(searchParams.entries());
  return validateRequest(schema, params);
}

// Re-export common schemas
export * from './user';
