
require('dotenv').config();

console.log('=== URL Configuration Audit ===\n');

console.log('📋 Environment Variables:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configured' : '❌ Missing');
console.log('  NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ Not Set');
console.log('  NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Configured' : '❌ Missing');
console.log('  XERO_REDIRECT_URI:', process.env.XERO_REDIRECT_URI || '❌ Not Set');
console.log('  XERO_CLIENT_ID:', process.env.XERO_CLIENT_ID ? '✅ Configured' : '❌ Missing');
console.log('  XERO_CLIENT_SECRET:', process.env.XERO_CLIENT_SECRET ? '✅ Configured' : '❌ Missing');

console.log('\n🔍 URL Validation:');

// Check NEXTAUTH_URL
const nextauthUrl = process.env.NEXTAUTH_URL;
if (nextauthUrl) {
  if (nextauthUrl.includes('preview.abacusai.app')) {
    console.log('  ⚠️  NEXTAUTH_URL points to PREVIEW URL:', nextauthUrl);
    console.log('      Expected: https://ampere.abacusai.app');
  } else if (nextauthUrl === 'https://ampere.abacusai.app') {
    console.log('  ✅ NEXTAUTH_URL correctly set to production');
  } else {
    console.log('  ⚠️  NEXTAUTH_URL unexpected value:', nextauthUrl);
  }
} else {
  console.log('  ❌ NEXTAUTH_URL not set');
}

// Check XERO_REDIRECT_URI
const xeroRedirect = process.env.XERO_REDIRECT_URI;
if (xeroRedirect) {
  if (xeroRedirect.includes('preview.abacusai.app')) {
    console.log('  ⚠️  XERO_REDIRECT_URI points to PREVIEW URL:', xeroRedirect);
    console.log('      Expected: https://ampere.abacusai.app/api/xero/callback');
  } else if (xeroRedirect === 'https://ampere.abacusai.app/api/xero/callback') {
    console.log('  ✅ XERO_REDIRECT_URI correctly set to production');
  } else {
    console.log('  ⚠️  XERO_REDIRECT_URI unexpected value:', xeroRedirect);
  }
} else {
  console.log('  ❌ XERO_REDIRECT_URI not set');
}

// Check URL consistency
console.log('\n🔗 URL Consistency Check:');
if (nextauthUrl && xeroRedirect) {
  const nextauthDomain = nextauthUrl.replace(/\/$/, ''); // Remove trailing slash
  const expectedRedirect = `${nextauthDomain}/api/xero/callback`;
  
  if (xeroRedirect === expectedRedirect) {
    console.log('  ✅ URLs are consistent');
  } else {
    console.log('  ⚠️  URL MISMATCH DETECTED:');
    console.log('      NEXTAUTH_URL:', nextauthUrl);
    console.log('      Expected Redirect:', expectedRedirect);
    console.log('      Actual Redirect:', xeroRedirect);
  }
}

console.log('\n📍 Xero App Configuration Required:');
console.log('  Redirect URI must be set in Xero app to:', xeroRedirect || 'https://ampere.abacusai.app/api/xero/callback');

console.log('\n=== Audit Complete ===\n');
