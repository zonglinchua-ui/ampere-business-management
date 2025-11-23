
/**
 * Xero Payment Pull Endpoint
 * 
 * Pulls payments from Xero and stores them locally with comprehensive validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getXeroClient } from '@/lib/xero-config'
import { XeroOAuthService } from '@/lib/xero-oauth-service'
import { XeroPaymentPullService } from '@/lib/xero/payment-sync-pull'
import { XeroLogger } from '@/lib/xero-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large datasets

/**
 * POST handler to pull payments from Xero
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let logId: string | undefined

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = session.user as any
    const userRole = user?.role || 'UNKNOWN'
    const allowedRoles = ['SUPERADMIN', 'FINANCE', 'PROJECT_MANAGER']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient permissions',
          message: `You need Super Admin, Finance, or Project Manager role. Your current role: ${userRole}`
        },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      modifiedSince,
      pageSize = 100,
      maxPages = 100,
      stopOnError = false
    } = body

    console.log('📥 Pulling payments from Xero...', { 
      modifiedSince,
      pageSize,
      maxPages,
      stopOnError,
      userEmail: user.email 
    })

    // Start logging
    logId = await XeroLogger.logSyncOperation({
      timestamp: new Date(),
      userId: user.id,
      direction: 'PULL',
      entity: 'PAYMENTS',
      status: 'IN_PROGRESS',
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      message: 'Pulling payments from Xero',
      duration: 0
    })

    // Get Xero tokens
    const tokens = await XeroOAuthService.getStoredTokens()
    if (!tokens) {
      throw new Error('No Xero tokens found. Please connect to Xero first.')
    }

    // Check token expiry
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    let activeTokens = tokens
    
    if (tokens.expiresAt <= fiveMinutesFromNow) {
      console.log('🔄 Token expires soon, refreshing...')
      const oauthService = new XeroOAuthService()
      const newTokens = await oauthService.refreshAccessToken(
        tokens.refreshToken,
        tokens.tenantId
      )

      if (!newTokens) {
        throw new Error('Failed to refresh Xero token')
      }
      activeTokens = newTokens
    }

    // Initialize Xero client
    const xeroClient = getXeroClient()
    xeroClient.setTokenSet({
      access_token: activeTokens.accessToken,
      refresh_token: activeTokens.refreshToken,
      expires_in: Math.floor((activeTokens.expiresAt.getTime() - Date.now()) / 1000),
      token_type: 'Bearer',
    })

    // Initialize pull service
    const pullService = new XeroPaymentPullService(user.id)

    // Fetch payments from Xero with pagination
    let currentPage = 1
    let hasMorePages = true
    let totalProcessed = 0
    let totalSucceeded = 0
    let totalFailed = 0
    let totalSkipped = 0
    const allErrors: any[] = []

    const modifiedSinceDate = modifiedSince ? new Date(modifiedSince) : undefined

    console.log('\n' + '='.repeat(80))
    console.log('🚀 XERO PAYMENT PULL SYNC STARTED')
    console.log('='.repeat(80) + '\n')

    while (hasMorePages && currentPage <= maxPages) {
      try {
        console.log(`\n📄 Fetching page ${currentPage}...`)

        const response = await xeroClient.accountingApi.getPayments(
          activeTokens.tenantId,
          modifiedSinceDate,
          undefined, // where
          undefined, // order
          currentPage,
          pageSize
        )

        const payments = response.body.payments || []
        console.log(`  ✅ Retrieved ${payments.length} payments`)

        if (payments.length === 0) {
          console.log('  ℹ️ No more payments to fetch')
          hasMorePages = false
          break
        }

        // Process batch
        const batchResult = await pullService.processBatch(payments)
        
        totalProcessed += batchResult.processed
        totalSucceeded += batchResult.succeeded
        totalFailed += batchResult.failed
        totalSkipped += batchResult.skipped
        allErrors.push(...batchResult.errors)

        console.log(`  📊 Page ${currentPage} complete:`, {
          processed: batchResult.processed,
          succeeded: batchResult.succeeded,
          skipped: batchResult.skipped,
          failed: batchResult.failed
        })

        // Update log periodically
        if (currentPage % 5 === 0) {
          await XeroLogger.updateLogEntry(logId!, {
            recordsProcessed: totalProcessed,
            recordsSucceeded: totalSucceeded + totalSkipped,
            recordsFailed: totalFailed,
            message: `Processing... ${totalProcessed} payments processed (page ${currentPage})`
          })
        }

        // Check if we should stop on error
        if (stopOnError && batchResult.failed > 0) {
          console.log('  🛑 Stopping due to errors (stopOnError=true)')
          hasMorePages = false
          break
        }

        // Check if there are more pages
        if (payments.length < pageSize) {
          console.log('  ℹ️ Last page reached (fewer records than page size)')
          hasMorePages = false
        } else {
          currentPage++
          // Rate limiting: wait 200ms between pages
          await new Promise(resolve => setTimeout(resolve, 200))
        }

      } catch (error: any) {
        console.error(`❌ Error fetching page ${currentPage}:`, error.message)
        
        // Check if it's a rate limit error
        if (error.response?.statusCode === 429) {
          const retryAfter = error.response.headers?.['retry-after'] || '60'
          console.log(`  ⏳ Rate limited. Waiting ${retryAfter}s...`)
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
          // Don't increment page, retry same page
          continue
        }

        // For other errors, decide whether to continue or stop
        if (stopOnError) {
          throw error
        } else {
          console.log(`  ⏭️ Skipping page ${currentPage} and continuing...`)
          currentPage++
        }
      }
    }

    // Calculate final stats
    const duration = Date.now() - startTime
    const success = totalFailed === 0

    const resultMessage = success
      ? `Successfully pulled ${totalSucceeded} payments from Xero (${totalSkipped} already existed)`
      : `Pulled payments with ${totalFailed} errors (${totalSucceeded} succeeded, ${totalSkipped} skipped, ${totalFailed} failed)`

    console.log('\n' + '='.repeat(80))
    console.log('✅ XERO PAYMENT PULL SYNC COMPLETE')
    console.log('='.repeat(80))
    console.log('Final Stats:')
    console.log(`  • Total Processed: ${totalProcessed}`)
    console.log(`  • Succeeded: ${totalSucceeded}`)
    console.log(`  • Skipped (existing): ${totalSkipped}`)
    console.log(`  • Failed: ${totalFailed}`)
    console.log(`  • Duration: ${(duration / 1000).toFixed(2)}s`)
    console.log('='.repeat(80) + '\n')

    // Update final log
    if (logId) {
      await XeroLogger.updateLogEntry(logId, {
        status: success ? 'SUCCESS' : totalSucceeded > 0 ? 'WARNING' : 'ERROR',
        message: resultMessage,
        recordsProcessed: totalProcessed,
        recordsSucceeded: totalSucceeded + totalSkipped,
        recordsFailed: totalFailed,
        duration,
        details: {
          succeeded: totalSucceeded,
          skipped: totalSkipped,
          failed: totalFailed,
          pages: currentPage - 1,
          errors: allErrors.slice(0, 50) // Log first 50 errors
        }
      })
    }

    // Return result
    return NextResponse.json({
      success,
      message: resultMessage,
      stats: {
        processed: totalProcessed,
        succeeded: totalSucceeded,
        skipped: totalSkipped,
        failed: totalFailed,
        pages: currentPage - 1,
        duration
      },
      errors: allErrors.slice(0, 100), // Return first 100 errors
      logId
    })

  } catch (error: any) {
    console.error('❌ Payment pull failed:', error)

    if (logId) {
      await XeroLogger.updateLogEntry(logId, {
        status: 'ERROR',
        message: `Payment pull failed: ${error.message}`,
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 1,
        duration: Date.now() - startTime,
        errorMessage: error.message,
        errorStack: error.stack
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Payment pull failed',
        message: error.message || 'An unexpected error occurred while pulling payments',
        details: error.stack
      },
      { status: 500 }
    )
  }
}
