
# 🚨 URGENT: Xero Integration Fix Required

## Current Status ❌
- **Error:** `unauthorized_client` and `Invalid redirect_uri`
- **Root Cause:** Xero app configuration uses old domain
- **App Configuration:** ✅ CORRECT (already fixed)
- **Xero Portal Configuration:** ❌ NEEDS UPDATE

## 🔧 IMMEDIATE SOLUTION

### Step 1: Update Xero App Configuration

**Go to Xero Developer Portal RIGHT NOW:**

1. **Visit:** https://developer.xero.com/app/manage
2. **Login** with your Xero developer credentials
3. **Find your app** with Client ID: `71C201203893448AA87867F089F938B2`
4. **Click on the app** to open settings
5. **Find "Redirect URIs" or "OAuth 2.0 Configuration"**
6. **CHANGE the redirect URI from:**
   ```
   OLD: https://ampere.abacusai.app/api/xero/callback
   NEW: https://4478c5f53.preview.abacusai.app/api/xero/callback
   ```
7. **SAVE** the changes
8. **WAIT 2-3 minutes** for Xero to propagate changes

### Step 2: Test the Connection
After updating Xero:
1. Go to: https://4478c5f53.preview.abacusai.app/finance
2. Click "Connect to Xero"
3. Should work without errors

---

## 🆘 ALTERNATIVE: Create New Xero App (If you can't access the old one)

If you can't access the existing Xero app:

### 1. Create New Xero App
1. Go to: https://developer.xero.com/app/manage
2. Click **"New app"**
3. Fill in:
   - **App name:** Ampere Business Management
   - **Integration type:** Web app
   - **Company URL:** `https://4478c5f53.preview.abacusai.app`
   - **OAuth redirect URI:** `https://4478c5f53.preview.abacusai.app/api/xero/callback`
   - **Scopes:** Select "Accounting" permissions

### 2. Update App Credentials
After creating the new app:
1. Copy the new **Client ID** and **Client Secret**
2. I'll update your app configuration with the new credentials

---

## 🔍 Verification Tools

### Current Configuration ✅
```
NEXTAUTH_URL=https://4478c5f53.preview.abacusai.app
XERO_CLIENT_ID=71C201203893448AA87867F089F938B2
XERO_REDIRECT_URI=https://4478c5f53.preview.abacusai.app/api/xero/callback
```

### Debug URL
Test configuration: https://4478c5f53.preview.abacusai.app/api/xero/debug

### Expected Authorization URL
```
https://login.xero.com/identity/connect/authorize?client_id=71C201203893448AA87867F089F938B2&scope=accounting.transactions%20accounting.contacts%20accounting.settings&response_type=code&redirect_uri=https%3A%2F%2F4478c5f53.preview.abacusai.app%2Fapi%2Fxero%2Fcallback&state=returnPage%3Dbusiness-management-app
```

---

## ⚠️ IMPORTANT NOTES

1. **Use the correct domain:** `https://4478c5f53.preview.abacusai.app` (NOT the old ampere.abacusai.app)
2. **Wait for propagation:** After updating Xero, wait 2-3 minutes
3. **Clear browser cache:** Clear cache for xero.com domain
4. **Exact match required:** The redirect URI must match EXACTLY (no trailing slashes)

---

## 📞 Next Steps

**Option 1:** Update existing Xero app (recommended)
**Option 2:** Create new Xero app (if can't access existing)
**Option 3:** Let me know if you need help with either approach

**After completing either option, the Xero integration will work perfectly!**

---
*Generated: September 27, 2025*
*Status: URGENT FIX REQUIRED*
