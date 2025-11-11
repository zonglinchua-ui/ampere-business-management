
import { XeroClient } from 'xero-node'

if (!process.env.XERO_CLIENT_ID) {
  throw new Error('XERO_CLIENT_ID is required')
}

if (!process.env.XERO_CLIENT_SECRET) {
  throw new Error('XERO_CLIENT_SECRET is required')
}

// Force production URLs - never use preview URLs for OAuth
const getProductionUrl = (envUrl: string | undefined): string => {
  if (!envUrl) return 'https://ampere.abacusai.app'
  return envUrl.includes('preview.abacusai.app') ? 'https://ampere.abacusai.app' : envUrl
}

const PRODUCTION_URL = 'https://ampere.abacusai.app'
const redirectUri = process.env.XERO_REDIRECT_URI?.includes('preview.abacusai.app')
  ? `${PRODUCTION_URL}/api/xero/callback`
  : (process.env.XERO_REDIRECT_URI || `${PRODUCTION_URL}/api/xero/callback`)

// Xero API Configuration
export const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUris: [redirectUri],
  scopes: (process.env.XERO_SCOPES || 'accounting.transactions accounting.contacts accounting.settings offline_access').split(' '),
  // Dynamic state generation is now handled in ImprovedXeroService
}

// Debug logging for configuration
export function debugXeroConfig() {
  const envRedirect = process.env.XERO_REDIRECT_URI
  const envNextAuth = process.env.NEXTAUTH_URL
  const hasPreviewUrl = envRedirect?.includes('preview.abacusai.app') || envNextAuth?.includes('preview.abacusai.app')
  
  console.log('=== Xero Configuration Debug ===')
  console.log('Client ID:', process.env.XERO_CLIENT_ID ? `${process.env.XERO_CLIENT_ID.substring(0, 8)}...` : 'NOT SET')
  console.log('Client Secret:', process.env.XERO_CLIENT_SECRET ? 'SET' : 'NOT SET')
  console.log('Redirect URI (used):', xeroConfig.redirectUris[0])
  if (hasPreviewUrl) {
    console.log('⚠️  Preview URL detected in env - forced to production')
    console.log('   XERO_REDIRECT_URI (env):', envRedirect)
    console.log('   NEXTAUTH_URL (env):', envNextAuth)
  }
  console.log('Scopes:', xeroConfig.scopes)
  console.log('================================')
}

// Create Xero Client instance
let xeroClient: XeroClient | null = null

export const getXeroClient = (): XeroClient => {
  if (!xeroClient) {
    xeroClient = new XeroClient({
      clientId: xeroConfig.clientId,
      clientSecret: xeroConfig.clientSecret,
      redirectUris: xeroConfig.redirectUris,
      scopes: xeroConfig.scopes,
      // State is now dynamically generated in ImprovedXeroService
    })
  }
  return xeroClient
}

// Xero API endpoints
export const xeroEndpoints = {
  // Authentication
  AUTH_URL: 'https://login.xero.com/identity/connect/authorize',
  TOKEN_URL: 'https://identity.xero.com/connect/token',
  
  // API Base
  API_BASE: 'https://api.xero.com/api.xro/2.0',
  
  // Endpoints
  CONTACTS: '/Contacts',
  INVOICES: '/Invoices',
  PAYMENTS: '/Payments',
  PURCHASE_ORDERS: '/PurchaseOrders',
  ITEMS: '/Items',
  ACCOUNTS: '/Accounts',
  ORGANISATIONS: '/Organisations',
  CURRENCIES: '/Currencies',
  TAX_RATES: '/TaxRates',
}

// Xero to App Data Mapping
export const xeroMappings = {
  contactType: {
    'CUSTOMER': 'client',
    'SUPPLIER': 'vendor',
    'CLIENT': 'client',
    'VENDOR': 'vendor',
  },
  
  invoiceType: {
    'ACCREC': 'invoice', // Accounts Receivable (Customer Invoice)
    'ACCPAY': 'bill',    // Accounts Payable (Vendor Bill)
  },
  
  invoiceStatus: {
    'DRAFT': 'DRAFT',
    'SUBMITTED': 'SENT',
    'AUTHORISED': 'SENT',
    'PAID': 'PAID',
    'VOIDED': 'CANCELLED',
  },
  
  paymentStatus: {
    'AUTHORISED': 'COMPLETED',
    'DELETED': 'CANCELLED',
  }
}
