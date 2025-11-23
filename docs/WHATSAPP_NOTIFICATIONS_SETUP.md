# WhatsApp Notifications Setup Guide

This guide explains how to set up WhatsApp notifications for Ampere Business Management System using WAHA (WhatsApp HTTP API).

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [WAHA Installation](#waha-installation)
4. [Ampere Configuration](#ampere-configuration)
5. [User Settings](#user-settings)
6. [Testing](#testing)
7. [Scheduling](#scheduling)
8. [Troubleshooting](#troubleshooting)

## Overview

The WhatsApp notification system sends automated reminders for:
- **Tender deadlines** (3 days before)
- **Task deadlines** (2 days before)
- **Outstanding invoices** (7 days before due date or overdue)
- **Outstanding progress claims** (5 days before submission)

## Prerequisites

- Docker installed on your server
- A WhatsApp account (phone number)
- Access to your server's command line

## WAHA Installation

### Step 1: Pull WAHA Docker Image

```bash
docker pull devlikeapro/waha
```

### Step 2: Initialize WAHA

This generates credentials for the API:

```bash
docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env
```

This will create a `.env` file with:
- Dashboard username/password
- API key

**Save these credentials!** You'll need the API key for Ampere configuration.

### Step 3: Run WAHA

```bash
docker run -d \
  --name waha \
  --env-file "$(pwd)/.env" \
  -v "$(pwd)/sessions:/app/.sessions" \
  -p 3000:3000 \
  --restart unless-stopped \
  devlikeapro/waha
```

**Important Notes:**
- Change port `3000` if it conflicts with Ampere (e.g., use `3001:3000`)
- Use `--restart unless-stopped` for production to auto-restart on server reboot

### Step 4: Access WAHA Dashboard

Open your browser and navigate to:
```
http://your-server-ip:3000/dashboard
```

Login with the username/password from Step 2.

### Step 5: Start WhatsApp Session

1. Click "Start Session" for the `default` session
2. Wait for QR code to appear
3. Open WhatsApp on your phone
4. Go to **Settings** > **Linked Devices** > **Link a Device**
5. Scan the QR code
6. Wait for session status to change to `WORKING`

**Keep your phone connected to the internet!** The session will disconnect if your phone is offline for too long.

## Ampere Configuration

### Step 1: Add Environment Variables

Add these to your Ampere `.env` file:

```env
# WhatsApp Notifications (WAHA)
WAHA_ENABLED=true
WAHA_API_URL=http://localhost:3000
WAHA_API_KEY=your_api_key_from_waha_init
WAHA_SESSION=default

# Optional: Cron security
CRON_SECRET=your_random_secret_here
```

**Notes:**
- If WAHA is on a different server, change `WAHA_API_URL` to that server's address
- If you changed WAHA's port to 3001, use `http://localhost:3001`
- Get `WAHA_API_KEY` from the WAHA `.env` file created in WAHA Step 2

### Step 2: Update Database Schema

Add `whatsappNotifications` field to User model (if not already present):

```prisma
model User {
  // ... existing fields
  phone                  String?
  whatsappNotifications  Boolean  @default(true)
}
```

Run migration:
```bash
npx prisma migrate dev --name add_whatsapp_notifications
```

### Step 3: Rebuild and Restart Ampere

```bash
# Pull latest code
git pull origin main

# Install dependencies (if new packages added)
yarn install

# Rebuild
yarn build

# Restart
pm2 restart ampere
```

## User Settings

### Enable/Disable Notifications Per User

Users can control their WhatsApp notifications in their profile settings:

1. Go to **Profile** > **Settings**
2. Find **WhatsApp Notifications** toggle
3. Enable/disable as needed

### Phone Number Format

Phone numbers must be stored in the database in international format without spaces or special characters:

**Correct formats:**
- `6512345678` (Singapore)
- `60123456789` (Malaysia)
- `6281234567890` (Indonesia)

**Incorrect formats:**
- `+65 1234 5678` (has spaces and +)
- `(65) 1234-5678` (has special characters)

The system will automatically clean phone numbers before sending.

## Testing

### Manual Test via API

Test if WhatsApp service is working:

```bash
curl -X POST http://localhost:3000/api/cron/whatsapp-notifications \
  -H "Authorization: Bearer your_cron_secret"
```

Expected response:
```json
{
  "success": true,
  "results": {
    "tenders": { "checked": 0, "notified": 0, "errors": 0 },
    "tasks": { "checked": 0, "notified": 0, "errors": 0 },
    "invoices": { "checked": 0, "notified": 0, "errors": 0 },
    "progressClaims": { "checked": 0, "notified": 0, "errors": 0 },
    "totalNotified": 0,
    "totalErrors": 0
  }
}
```

### Test Individual Notification

You can test sending a notification by creating a test task with a due date 1-2 days from now, then triggering the cron job.

## Scheduling

### Option 1: External Cron Service (Recommended)

Use a service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. Create a new cron job
2. Set URL: `https://your-domain.com/api/cron/whatsapp-notifications`
3. Set schedule: **Every 6 hours** (or twice daily at 9 AM and 3 PM)
4. Add header: `Authorization: Bearer your_cron_secret`

### Option 2: Server Crontab

Add to your server's crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every 6 hours)
0 */6 * * * curl -X POST http://localhost:3000/api/cron/whatsapp-notifications -H "Authorization: Bearer your_cron_secret"
```

### Option 3: PM2 Cron

If using PM2, you can use `pm2-cron`:

```bash
npm install -g pm2-cron
pm2 install pm2-cron
```

Then configure in your PM2 ecosystem file.

## Notification Schedule

| Type | Trigger | Example |
|------|---------|---------|
| Tender Deadline | 3 days before | Tender due Nov 17 → Notify Nov 14 |
| Task Deadline | 2 days before | Task due Nov 17 → Notify Nov 15 |
| Invoice Due | 7 days before or overdue | Invoice due Nov 17 → Notify Nov 10 |
| Progress Claim | 5 days before | Claim due Nov 17 → Notify Nov 12 |

## Troubleshooting

### WhatsApp Session Disconnected

**Symptoms:** Notifications stop sending, WAHA dashboard shows session as `STOPPED`

**Solutions:**
1. Check if your phone is online
2. Check if WhatsApp is still linked (Settings > Linked Devices)
3. Restart the session in WAHA dashboard
4. If QR code appears, scan it again

### Notifications Not Sending

**Check these:**

1. **WAHA is running:**
   ```bash
   docker ps | grep waha
   ```

2. **WAHA session is WORKING:**
   - Open WAHA dashboard
   - Check session status

3. **Environment variables are set:**
   ```bash
   # In your Ampere directory
   cat .env | grep WAHA
   ```

4. **User has phone number:**
   - Check database: User must have `phone` field populated
   - Check format: Must be numbers only, no spaces or +

5. **User has notifications enabled:**
   - Check database: `whatsappNotifications` should be `true`

6. **Check logs:**
   ```bash
   # WAHA logs
   docker logs waha

   # Ampere logs
   pm2 logs ampere
   ```

### Test WAHA Directly

Send a test message directly to WAHA:

```bash
curl -X POST http://localhost:3000/api/sendText \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_waha_api_key" \
  -d '{
    "session": "default",
    "chatId": "6512345678@c.us",
    "text": "Test message from WAHA"
  }'
```

Replace `6512345678` with your phone number (no + or spaces).

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WhatsApp service not available` | WAHA not running or wrong URL | Check WAHA is running, verify `WAHA_API_URL` |
| `Invalid API key` | Wrong API key in env | Check `WAHA_API_KEY` matches WAHA's `.env` |
| `Session not found` | Wrong session name | Check `WAHA_SESSION` matches WAHA dashboard |
| `Failed to send message` | Session disconnected | Restart session in WAHA dashboard |
| `Phone number invalid` | Wrong format | Ensure numbers only, no + or spaces |

## Security Considerations

1. **Secure WAHA:**
   - Don't expose WAHA port (3000) to the internet
   - Use strong API keys
   - Keep WAHA updated

2. **Secure Cron Endpoint:**
   - Use `CRON_SECRET` to prevent unauthorized triggers
   - Consider IP whitelisting if using external cron service

3. **User Privacy:**
   - Only send notifications to users who opted in
   - Don't include sensitive data in messages
   - Respect user's notification preferences

## Maintenance

### Update WAHA

```bash
# Stop WAHA
docker stop waha
docker rm waha

# Pull latest image
docker pull devlikeapro/waha

# Run with same command as before
docker run -d \
  --name waha \
  --env-file "$(pwd)/.env" \
  -v "$(pwd)/sessions:/app/.sessions" \
  -p 3000:3000 \
  --restart unless-stopped \
  devlikeapro/waha
```

### Backup Sessions

The WhatsApp session data is stored in `./sessions` directory. Back this up regularly:

```bash
tar -czf waha-sessions-backup-$(date +%Y%m%d).tar.gz sessions/
```

## Support

For WAHA-specific issues:
- Documentation: https://waha.devlike.pro/docs
- GitHub: https://github.com/devlikeapro/waha

For Ampere integration issues:
- Check system logs in Ampere dashboard
- Review PM2 logs: `pm2 logs ampere`
- Check WAHA logs: `docker logs waha`
