/**
 * Diagnostic Script: Check Xero Token Status
 * Run this to see if tokens exist and when they expire
 */

import { prisma } from '../lib/db'

async function checkTokens() {
  console.log('\n=== Xero Token Diagnostic ===\n')

  try {
    const integrations = await prisma.xeroIntegration.findMany({
      orderBy: { connectedAt: 'desc' }
    })

    if (integrations.length === 0) {
      console.log('❌ No Xero integrations found in database')
      return
    }

    console.log(`Found ${integrations.length} integration(s):\n`)

    for (const integration of integrations) {
      console.log(`Integration ID: ${integration.id}`)
      console.log(`Tenant ID: ${integration.tenantId}`)
      console.log(`Tenant Name: ${integration.tenantName || 'N/A'}`)
      console.log(`Is Active: ${integration.isActive ? '✅ YES' : '❌ NO'}`)
      console.log(`Connected At: ${integration.connectedAt.toISOString()}`)
      console.log(`Last Sync: ${integration.lastSyncAt?.toISOString() || 'Never'}`)
      console.log(`Token Expires At: ${integration.expiresAt.toISOString()}`)
      
      const now = new Date()
      const timeUntilExpiry = integration.expiresAt.getTime() - now.getTime()
      const minutesUntilExpiry = Math.round(timeUntilExpiry / 60000)
      
      if (timeUntilExpiry > 0) {
        console.log(`Time Until Expiry: ${minutesUntilExpiry} minutes`)
        if (minutesUntilExpiry < 20) {
          console.log('⚠️  Token expiring soon - should auto-refresh')
        } else {
          console.log('✅ Token still valid')
        }
      } else {
        console.log(`❌ Token EXPIRED ${Math.abs(minutesUntilExpiry)} minutes ago`)
      }
      
      console.log(`Has Access Token: ${integration.accessToken ? '✅ YES' : '❌ NO'}`)
      console.log(`Has Refresh Token: ${integration.refreshToken ? '✅ YES' : '❌ NO'}`)
      console.log(`Scopes: ${integration.scopes.join(', ')}`)
      console.log(`Created By: ${integration.createdById}`)
      console.log('\n' + '='.repeat(60) + '\n')
    }

    // Check active integration
    const activeIntegration = integrations.find(i => i.isActive)
    if (activeIntegration) {
      console.log('✅ Active integration found')
      console.log(`   Tenant: ${activeIntegration.tenantName}`)
      console.log(`   Expires: ${activeIntegration.expiresAt.toISOString()}`)
    } else {
      console.log('❌ No active integration found')
      console.log('   This is why tokens appear to be "missing"')
      console.log('   Check why isActive was set to false')
    }

  } catch (error) {
    console.error('❌ Error checking tokens:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTokens().catch(console.error)
