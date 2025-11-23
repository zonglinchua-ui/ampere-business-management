/**
 * File upload validation and security
 * 
 * Validates file size, type, and content to prevent:
 * - DoS attacks via large files
 * - Malicious file uploads
 * - Storage exhaustion
 */

import { NextResponse } from 'next/server';

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB for images
  DOCUMENT: 10 * 1024 * 1024, // 10MB for documents
  SPREADSHEET: 20 * 1024 * 1024, // 20MB for spreadsheets
  DEFAULT: 10 * 1024 * 1024, // 10MB default
};

// Allowed MIME types
export const ALLOWED_FILE_TYPES = {
  IMAGES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain',
  ],
  SPREADSHEETS: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/csv',
  ],
  ALL: [] as string[], // Will be populated below
};

// Populate ALL types
ALLOWED_FILE_TYPES.ALL = [
  ...ALLOWED_FILE_TYPES.IMAGES,
  ...ALLOWED_FILE_TYPES.DOCUMENTS,
  ...ALLOWED_FILE_TYPES.SPREADSHEETS,
];

/**
 * Validate uploaded file
 */
export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorResponse?: NextResponse;
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    maxSize = FILE_SIZE_LIMITS.DEFAULT,
    allowedTypes = ALLOWED_FILE_TYPES.ALL,
    allowedExtensions,
  } = options;

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`,
      errorResponse: NextResponse.json(
        { error: `File too large. Maximum size is ${maxSizeMB}MB` },
        { status: 413 }
      ),
    };
  }

  // Check MIME type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}`,
      errorResponse: NextResponse.json(
        { error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      ),
    };
  }

  // Check file extension if specified
  if (allowedExtensions && allowedExtensions.length > 0) {
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext =>
      fileName.endsWith(ext.toLowerCase())
    );

    if (!hasValidExtension) {
      return {
        valid: false,
        error: `Invalid file extension`,
        errorResponse: NextResponse.json(
          { error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` },
          { status: 400 }
        ),
      };
    }
  }

  // Check for suspicious file names
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid file name',
      errorResponse: NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      ),
    };
  }

  return { valid: true };
}

/**
 * Sanitize file name
 * Removes special characters and limits length
 */
export function sanitizeFileName(fileName: string, maxLength: number = 255): string {
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  
  // Remove special characters except dots, dashes, and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length while preserving extension
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, maxLength - ext.length);
    sanitized = name + ext;
  }
  
  return sanitized;
}

/**
 * Example usage in API route:
 * 
 * ```typescript
 * export async function POST(request: Request) {
 *   const formData = await request.formData();
 *   const file = formData.get('file') as File;
 *   
 *   // Validate file
 *   const validation = validateFile(file, {
 *     maxSize: FILE_SIZE_LIMITS.DOCUMENT,
 *     allowedTypes: ALLOWED_FILE_TYPES.DOCUMENTS,
 *   });
 *   
 *   if (!validation.valid) {
 *     return validation.errorResponse;
 *   }
 *   
 *   // Sanitize file name
 *   const safeFileName = sanitizeFileName(file.name);
 *   
 *   // Proceed with upload...
 * }
 * ```
 */
