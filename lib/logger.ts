/**
 * Production-safe logger with comprehensive logging capabilities
 * Handles activity logs, error logs, system logs, and notifications
 */

import { prisma } from "./db"
import { NextRequest } from "next/server"

const isDevelopment = process.env.NODE_ENV === 'development'

// Basic console logging (production-safe)
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  
  error: (...args: any[]) => {
    console.error(...args)
  }
}

// Helper for conditional logging
export const devLog = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(`[DEV] ${message}`, ...args)
  }
}

// Get IP address from request
export function getIpAddress(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  if (realIp) {
    return realIp
  }
  
  return 'unknown'
}

// Log user activity
interface LogActivityParams {
  userId: string
  username?: string
  role?: string
  action: string
  message: string
  ipAddress?: string
  module?: string
  endpoint?: string
  metadata?: any
  [key: string]: any // Allow additional properties
}

export async function logActivity(params: LogActivityParams) {
  try {
    const { userId, username, role, action, message, ipAddress, module, endpoint, metadata, ...extra } = params
    
    await prisma.system_logs.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'ACTIVITY',
        status: 'SUCCESS',
        message: message,
        module: module || action,
        action: action,
        userId: userId,
        username: username,
        role: role,
        ipAddress: ipAddress,
        endpoint: endpoint,
      }
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[Logger] Failed to log activity:', error)
  }
}

// Log errors
interface LogErrorParams {
  userId?: string
  username?: string
  role?: string
  action: string
  error?: any
  message?: string
  ipAddress?: string
  module?: string
  endpoint?: string
  errorCode?: string
  isCritical?: boolean
  metadata?: any
  [key: string]: any // Allow additional properties
}

export async function logError(params: LogErrorParams) {
  try {
    const { userId, username, role, action, error, message, ipAddress, module, endpoint, errorCode, isCritical, metadata, ...extra } = params
    const errorMessage = message || (error instanceof Error ? error.message : String(error || 'Unknown error'))
    
    await prisma.system_logs.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'ERROR',
        status: isCritical ? 'CRITICAL' : 'FAILED',
        message: errorMessage,
        module: module || action,
        action: action,
        userId: userId,
        username: username,
        role: role,
        ipAddress: ipAddress,
        endpoint: endpoint,
        errorCode: errorCode,
      }
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[Logger] Failed to log error:', error)
  }
}

// Create system log
interface CreateSystemLogParams {
  type: 'ACTIVITY' | 'ERROR' | 'NOTIFICATION'
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'CRITICAL'
  message: string
  module?: string
  action?: string
  userId?: string
  username?: string
  userRole?: string
  role?: string
  ipAddress?: string
  errorCode?: string
  metadata?: any
  [key: string]: any // Allow additional properties
}

export async function createSystemLog(params: CreateSystemLogParams) {
  try {
    const { type, status, message, module, action, userId, username, userRole, role, ipAddress, errorCode, metadata, ...extra } = params
    
    await prisma.system_logs.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type,
        status: status,
        message: message || 'System log',
        module: module || 'System',
        action: action || 'Log',
        userId: userId,
        username: username,
        role: userRole || role,
        ipAddress: ipAddress,
        errorCode: errorCode,
      }
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[Logger] Failed to create system log:', error)
  }
}

// Create notification log
export async function createNotificationLog(params: {
  userId: string
  message: string
  type: string
  metadata?: any
}) {
  try {
    await prisma.system_logs.create({
      data: {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'NOTIFICATION',
        status: 'SUCCESS',
        message: params.message,
        module: 'Notifications',
        action: params.type,
        userId: params.userId,
      }
    })
  } catch (error) {
    console.error('[Logger] Failed to create notification log:', error)
  }
}
