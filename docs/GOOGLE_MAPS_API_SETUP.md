# Google Maps API Setup Guide

## Issue: "The provided API key is invalid"

This error occurs when the Google Maps Geocoding API is not properly configured. Follow these steps to fix it:

---

## Step 1: Enable the Geocoding API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Search for **"Geocoding API"**
5. Click on **Geocoding API**
6. Click **ENABLE**

**Also enable these APIs for full functionality:**
- Maps JavaScript API (for displaying maps)
- Places API (for address autocomplete)
- Geocoding API (for converting addresses to coordinates)

---

## Step 2: Create or Update API Keys

You need **TWO** API keys with different restrictions:

### A. Client-Side API Key (for browser/frontend)

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **API key**
3. Click **Edit API key** (pencil icon)
4. Name it: `Ampere Business Management - Client`
5. Under **API restrictions**:
   - Select **Restrict key**
   - Check these APIs:
     - Maps JavaScript API
     - Places API
6. Under **Website restrictions**:
   - Select **HTTP referers (web sites)**
   - Add your domains:
     ```
     http://localhost:3000/*
     http://localhost:*
     https://yourdomain.com/*
     https://*.yourdomain.com/*
     ```
7. Click **SAVE**
8. Copy the API key

### B. Server-Side API Key (for backend/API routes)

1. Click **+ CREATE CREDENTIALS** > **API key** again
2. Click **Edit API key**
3. Name it: `Ampere Business Management - Server`
4. Under **API restrictions**:
   - Select **Restrict key**
   - Check these APIs:
     - Geocoding API
5. Under **Application restrictions**:
   - Select **IP addresses**
   - Add your server's IP address
   - For development, you can temporarily select **None** (but this is less secure)
6. Click **SAVE**
7. Copy the API key

---

## Step 3: Update Environment Variables

Update your `.env` file with both API keys:

```bash
# Client-side API key (with HTTP referer restrictions)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your_client_key

# Server-side API key (with IP restrictions or no restrictions)
GOOGLE_MAPS_SERVER_API_KEY=AIzaSy...your_server_key
GOOGLE_MAPS_API_KEY=AIzaSy...your_server_key
```

**Important:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is exposed to the browser (client-side)
- `GOOGLE_MAPS_SERVER_API_KEY` is only used on the server (never exposed to browser)
- Never commit `.env` to Git!

---

## Step 4: Restart the Application

After updating the environment variables:

```powershell
# Stop the running application (Ctrl+C)

# Rebuild and restart
yarn build
yarn start
```

---

## Step 5: Test Geocoding

1. Create or edit a project
2. Enter an address in the "Project Location" section
3. The system should automatically geocode the address
4. Check the browser console for any errors
5. Check the server logs for geocoding success messages

---

## Troubleshooting

### Error: "REQUEST_DENIED"
- **Cause**: Geocoding API not enabled or API key restrictions too strict
- **Solution**: 
  1. Enable Geocoding API in Google Cloud Console
  2. Check API key restrictions match your setup

### Error: "OVER_QUERY_LIMIT"
- **Cause**: Exceeded free tier quota (2,500 requests/day)
- **Solution**: 
  1. Enable billing in Google Cloud Console
  2. Or wait 24 hours for quota to reset

### Error: "ZERO_RESULTS"
- **Cause**: Address not found by Google Maps
- **Solution**: 
  1. Use a more complete address
  2. Include city, postal code, and country

### Geocoding works but map doesn't show
- **Cause**: Maps JavaScript API not enabled or client API key has wrong restrictions
- **Solution**:
  1. Enable Maps JavaScript API
  2. Check HTTP referer restrictions on client API key

---

## Security Best Practices

1. **Use separate API keys** for client and server
2. **Always restrict API keys**:
   - Client keys: HTTP referer restrictions
   - Server keys: IP address restrictions
3. **Never commit API keys** to version control
4. **Rotate keys regularly** (every 90 days)
5. **Monitor usage** in Google Cloud Console
6. **Set up billing alerts** to avoid unexpected charges

---

## Cost Estimation

**Free Tier (per month):**
- Geocoding API: $200 credit = ~40,000 requests
- Maps JavaScript API: $200 credit = ~28,000 map loads
- Places API: $200 credit = varies by request type

**Typical Usage for Ampere Business Management:**
- Creating 100 projects/month: ~100 geocoding requests
- Viewing dashboard daily: ~30 map loads/month
- **Total cost: $0** (well within free tier)

---

## Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Geocoding API Documentation](https://developers.google.com/maps/documentation/geocoding)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)

