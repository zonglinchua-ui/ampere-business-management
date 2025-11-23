# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please email security@ampere.com.sg instead of using the public issue tracker.

## Security Measures Implemented

### 1. Sensitive Data Protection

**Status:** ✅ Implemented

- All backup files (`.backup`, `.bak`, `.old`) are excluded from version control
- Environment files (`.env`, `.env.local`) are never committed
- Credentials are rotated if accidentally exposed

**Action Required:**
- Never commit `.env` files or backup files
- Use `.env.example` for documentation only
- Rotate credentials immediately if exposed

### 2. XSS (Cross-Site Scripting) Protection

**Status:** ✅ Fixed

- Removed all `dangerouslySetInnerHTML` usage
- User-generated content is rendered as plain text
- HTML sanitization is applied where necessary

**Best Practices:**
- Never use `dangerouslySetInnerHTML` unless absolutely necessary
- If HTML rendering is required, use DOMPurify for sanitization
- Prefer plain text rendering with `<pre>` tags

### 3. Rate Limiting

**Status:** ✅ Implemented (In-memory)

- Rate limiting utility created at `lib/rate-limit.ts`
- Example usage provided in `lib/rate-limit-example.ts`
- Ready to apply to critical API routes

**Recommended Limits:**
- Authentication endpoints: 5-10 requests/minute
- Read operations (GET): 30-60 requests/minute
- Write operations (POST/PUT/DELETE): 10-20 requests/minute
- File uploads: 5-10 requests/5 minutes

**Production Upgrade:**
For production environments with multiple servers, upgrade to Redis-based rate limiting:

```bash
npm install @upstash/ratelimit @upstash/redis
```

See: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview

### 4. Authentication & Authorization

**Current Implementation:**
- NextAuth.js for authentication
- Role-based access control (RBAC)
- Bcrypt for password hashing

**Security Checklist:**
- ✅ Passwords are hashed with bcrypt (10 rounds)
- ✅ Session tokens are secure and httpOnly
- ✅ CSRF protection enabled
- ⚠️ TODO: Implement 2FA for admin accounts
- ⚠️ TODO: Add account lockout after failed login attempts

### 5. Database Security

**Current Implementation:**
- Parameterized queries via Prisma ORM (SQL injection protection)
- Database credentials stored in environment variables
- Connection pooling enabled

**Best Practices:**
- Never use raw SQL queries without parameterization
- Regularly backup database
- Use read-only database users for reporting queries

### 6. File Upload Security

**Current Implementation:**
- File type validation
- File size limits
- Secure file storage on NAS

**TODO:**
- ⚠️ Add virus scanning for uploaded files
- ⚠️ Implement file content validation
- ⚠️ Add file quarantine for suspicious uploads

### 7. API Security

**Current Implementation:**
- Authentication required for all API routes
- CORS configured
- Request validation

**TODO:**
- ⚠️ Apply rate limiting to all public API routes
- ⚠️ Add request signature validation for webhooks
- ⚠️ Implement API key rotation

### 8. Production Deployment Security

**Pre-Deployment Checklist:**

- [ ] All environment variables are set in production
- [ ] `NODE_ENV=production` is configured
- [ ] Database credentials are rotated
- [ ] `NEXTAUTH_SECRET` is unique and secure (32+ characters)
- [ ] HTTPS is enabled (via Cloudflare or Let's Encrypt)
- [ ] Firewall rules are configured (only ports 80, 443 open)
- [ ] Rate limiting is applied to authentication routes
- [ ] Database backups are automated
- [ ] Error logging is configured (no sensitive data in logs)
- [ ] Security headers are configured in IIS/Nginx

**Security Headers (Add to IIS/Nginx):**

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 9. Monitoring & Logging

**TODO:**
- ⚠️ Set up security event logging
- ⚠️ Monitor failed login attempts
- ⚠️ Alert on suspicious activity
- ⚠️ Regular security audits

### 10. Dependency Security

**Current Practice:**
- Regular dependency updates
- Automated vulnerability scanning (via GitHub Dependabot)

**Action Required:**
- Review and update dependencies monthly
- Monitor security advisories
- Test updates in staging before production

## Security Contacts

- **Security Team:** security@ampere.com.sg
- **Development Team:** dev@ampere.com.sg

## Version History

- **2025-11-20:** Initial security policy created
  - Removed sensitive backup files from repository
  - Fixed XSS vulnerability in system logs
  - Implemented rate limiting utility
  - Updated .gitignore for security

---

**Last Updated:** November 20, 2025
