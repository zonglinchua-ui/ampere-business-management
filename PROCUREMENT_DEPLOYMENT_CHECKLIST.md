# Procurement Document Management System - Deployment Checklist

## Pre-Deployment Preparation

### 1. Code Review and Version Control

- [ ] All code committed to Git repository
- [ ] No uncommitted changes in working directory
- [ ] Code reviewed by at least one other developer
- [ ] All console.log statements removed or replaced with proper logging
- [ ] No hardcoded credentials or sensitive data in code
- [ ] Version tagged in Git (e.g., `v1.0.0-procurement`)

### 2. Dependencies Installation

```bash
cd C:\ampere\ampere_business_management
pnpm add pdfkit @types/pdfkit react-dropzone
```

- [ ] Dependencies installed successfully
- [ ] No dependency conflicts reported
- [ ] `package.json` and `pnpm-lock.yaml` updated
- [ ] Dependencies tested in development environment

### 3. Environment Variables

Verify all required environment variables are set in `.env`:

```env
# Database
DATABASE_URL="postgresql://ampere_user:Ampere2024!@localhost:5433/ampere_db"

# Ollama
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1:8b"

# NAS Storage
NAS_BASE_PATH="C:/ampere/nas"

# NextAuth (existing)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[existing secret]"
```

- [ ] All variables present and correct
- [ ] Paths use forward slashes (even on Windows)
- [ ] No trailing slashes on paths
- [ ] Database credentials correct
- [ ] Ollama URL accessible

### 4. Database Migration

**Backup Database First**:
```bash
$env:PGPASSWORD='Ampere2024!'
pg_dump -h localhost -p 5433 -U ampere_user -d ampere_db -F c -f ampere_db_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump
```

- [ ] Database backup completed successfully
- [ ] Backup file verified and stored safely

**Apply Migration**:
```bash
cd C:\ampere\ampere_business_management
$env:PGPASSWORD='Ampere2024!'
psql -h localhost -p 5433 -U ampere_user -d ampere_db -f prisma\migrations\add_procurement_document_management.sql
```

- [ ] Migration executed without errors
- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] Foreign keys established correctly

**Verify Migration**:
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'Procurement%';

-- Check enums
SELECT typname FROM pg_type 
WHERE typname LIKE 'Procurement%';

-- Check relations
SELECT * FROM "ProcurementDocument" LIMIT 1;
SELECT * FROM "ProcurementDocumentLineItem" LIMIT 1;
SELECT * FROM "ProcurementPORequest" LIMIT 1;
SELECT * FROM "ProcurementApprovalHistory" LIMIT 1;
```

- [ ] All 4 tables exist
- [ ] All 3 enums exist
- [ ] Sample queries execute without errors

### 5. NAS Folder Structure

Create required folders:

```powershell
$nasPath = "C:\ampere\nas"

# Create main folders
New-Item -Path "$nasPath\PROJECT" -ItemType Directory -Force
New-Item -Path "$nasPath\POs" -ItemType Directory -Force

# Verify permissions
icacls "$nasPath" /grant "Everyone:(OI)(CI)F"
```

- [ ] PROJECT folder created
- [ ] POs folder created
- [ ] Permissions set correctly
- [ ] Write access verified

### 6. Ollama Service

**Verify Ollama is running**:
```bash
curl http://localhost:11434/api/tags
```

- [ ] Ollama service running
- [ ] llama3.1:8b model available
- [ ] API responding correctly

**If not running, start Ollama**:
```bash
ollama serve
```

- [ ] Service started successfully
- [ ] Accessible at configured URL

## Deployment Steps

### 7. Build Application

```bash
cd C:\ampere\ampere_business_management
pnpm build
```

- [ ] Build completed without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build output verified in `.next` folder

### 8. Stop Current Application

```bash
pm2 stop ampere-app
```

- [ ] Application stopped successfully
- [ ] No active connections remain

### 9. Deploy New Code

```bash
# Pull latest code (if using Git)
git pull origin main

# Or copy files if deploying manually
# Ensure all new files are in place
```

- [ ] All new API routes copied
- [ ] All new components copied
- [ ] All new pages copied
- [ ] Migration file in place

### 10. Start Application

```bash
pm2 start ampere-app
pm2 save
```

- [ ] Application started successfully
- [ ] No startup errors in logs
- [ ] Application accessible at configured URL

### 11. Verify Deployment

**Check Application Status**:
```bash
pm2 status
pm2 logs ampere-app --lines 50
```

- [ ] Application status: "online"
- [ ] No error messages in logs
- [ ] Memory usage normal

**Test Basic Access**:
- [ ] Homepage loads correctly
- [ ] Login works
- [ ] Existing features still work
- [ ] No console errors in browser

## Post-Deployment Verification

### 12. Smoke Tests

**Test 1: Access Procurement Page**
- [ ] Navigate to a project
- [ ] Click "Procurement" tab (or navigate to `/projects/[id]/procurement`)
- [ ] Page loads without errors
- [ ] Upload and List tabs visible

**Test 2: Upload Document**
- [ ] Click "Upload Document" tab
- [ ] Select document type
- [ ] Upload a test PDF
- [ ] Verify upload completes
- [ ] Check AI extraction works
- [ ] Verify document appears in list

**Test 3: Generate PO**
- [ ] Upload a quotation
- [ ] Click "Generate PO" button
- [ ] Form opens and pre-fills
- [ ] Submit PO request
- [ ] Verify success message

**Test 4: Approval Dashboard (Superadmin)**
- [ ] Login as superadmin
- [ ] Navigate to `/procurement/approvals`
- [ ] Verify pending requests appear
- [ ] Approve a request
- [ ] Verify PDF generated in NAS

**Test 5: Invoice Linking**
- [ ] Upload an invoice
- [ ] Click "Link to PO" button
- [ ] Select a PO
- [ ] Complete linking
- [ ] Verify status updated

### 13. File System Verification

- [ ] Check NAS folders for generated files
- [ ] Verify PDF files are readable
- [ ] Check file naming conventions correct
- [ ] Verify files in both project and central folders

### 14. Database Verification

```sql
-- Check document records
SELECT COUNT(*) FROM "ProcurementDocument";

-- Check PO requests
SELECT COUNT(*) FROM "ProcurementPORequest";

-- Check approval history
SELECT COUNT(*) FROM "ProcurementApprovalHistory";

-- Check line items
SELECT COUNT(*) FROM "ProcurementDocumentLineItem";
```

- [ ] Records created correctly
- [ ] Foreign keys working
- [ ] No orphaned records

### 15. Performance Check

- [ ] Page load times acceptable (< 3 seconds)
- [ ] Document upload responsive
- [ ] AI extraction completes in reasonable time (< 30 seconds)
- [ ] PDF generation fast (< 5 seconds)
- [ ] No memory leaks observed

## User Acceptance Testing

### 16. UAT Preparation

- [ ] Test user accounts created
- [ ] Sample documents prepared
- [ ] UAT environment ready
- [ ] User guide provided to testers

### 17. UAT Execution

- [ ] Users can upload documents successfully
- [ ] AI extraction meets accuracy expectations
- [ ] PO generation workflow intuitive
- [ ] Approval process clear
- [ ] Invoice matching works as expected
- [ ] VO handling understood and functional

### 18. UAT Feedback

- [ ] Feedback collected from users
- [ ] Issues documented
- [ ] Critical issues resolved
- [ ] Enhancement requests logged for future

## Training and Documentation

### 19. User Training

- [ ] Training sessions scheduled
- [ ] User guide distributed
- [ ] Demo videos created (if applicable)
- [ ] Q&A session conducted
- [ ] Support contact information provided

### 20. Documentation

- [ ] User guide finalized
- [ ] Admin guide created
- [ ] API documentation updated
- [ ] Troubleshooting guide available
- [ ] Deployment notes archived

## Monitoring and Support

### 21. Monitoring Setup

- [ ] Error logging configured
- [ ] Performance monitoring enabled
- [ ] Disk space monitoring (NAS)
- [ ] Database monitoring active

### 22. Support Plan

- [ ] Support team briefed
- [ ] Escalation procedures defined
- [ ] Bug reporting process established
- [ ] Hotfix deployment process ready

## Rollback Plan

### 23. Rollback Preparation

**If deployment fails, follow these steps**:

1. **Stop Application**:
   ```bash
   pm2 stop ampere-app
   ```

2. **Restore Previous Code**:
   ```bash
   git checkout [previous-commit-hash]
   pnpm install
   pnpm build
   ```

3. **Rollback Database** (if needed):
   ```bash
   $env:PGPASSWORD='Ampere2024!'
   
   # Drop new tables
   psql -h localhost -p 5433 -U ampere_user -d ampere_db -c "
   DROP TABLE IF EXISTS \"ProcurementApprovalHistory\";
   DROP TABLE IF EXISTS \"ProcurementPORequest\";
   DROP TABLE IF EXISTS \"ProcurementDocumentLineItem\";
   DROP TABLE IF EXISTS \"ProcurementDocument\";
   DROP TYPE IF EXISTS \"ProcurementPaymentTerms\";
   DROP TYPE IF EXISTS \"ProcurementDocumentStatus\";
   DROP TYPE IF EXISTS \"ProcurementDocumentType\";
   "
   
   # Or restore from backup
   pg_restore -h localhost -p 5433 -U ampere_user -d ampere_db -c [backup-file].dump
   ```

4. **Restart Application**:
   ```bash
   pm2 start ampere-app
   ```

- [ ] Rollback procedure documented
- [ ] Rollback tested in staging (if available)
- [ ] Team aware of rollback process

## Final Sign-Off

### 24. Deployment Approval

**Checklist Review**:
- [ ] All pre-deployment tasks completed
- [ ] All deployment steps executed successfully
- [ ] All post-deployment verifications passed
- [ ] UAT completed and approved
- [ ] Training completed
- [ ] Monitoring active
- [ ] Support team ready

**Sign-Off**:

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| QA Lead | | | |
| Project Manager | | | |
| System Administrator | | | |
| Business Owner | | | |

**Deployment Status**: ☐ Successful ☐ Failed ☐ Rolled Back

**Notes**:
```
[Any additional notes or observations about the deployment]
```

## Post-Deployment Tasks

### 25. Week 1 Monitoring

- [ ] Day 1: Check logs for errors
- [ ] Day 2: Verify file storage growing correctly
- [ ] Day 3: Check database performance
- [ ] Day 4: Review user feedback
- [ ] Day 5: Monitor system resources
- [ ] Week 1: Generate usage report

### 26. Optimization

- [ ] Identify performance bottlenecks
- [ ] Optimize slow queries
- [ ] Adjust AI extraction parameters if needed
- [ ] Fine-tune file storage strategy
- [ ] Implement caching if beneficial

### 27. Future Enhancements

**Planned Features** (for future releases):
- [ ] Email notifications for approvals
- [ ] Bulk document upload
- [ ] Advanced search and filtering
- [ ] Reporting dashboard
- [ ] Mobile app support
- [ ] Integration with accounting systems

---

## Emergency Contacts

**Technical Support**:
- Developer: [Name] - [Email] - [Phone]
- System Admin: [Name] - [Email] - [Phone]
- Database Admin: [Name] - [Email] - [Phone]

**Business Contacts**:
- Project Manager: [Name] - [Email] - [Phone]
- Business Owner: [Name] - [Email] - [Phone]

**Vendor Support**:
- Ollama: https://ollama.ai/support
- PostgreSQL: https://www.postgresql.org/support/

---

## Deployment Date and Time

**Scheduled Deployment**:
- Date: _____________
- Time: _____________
- Duration: _____________

**Actual Deployment**:
- Start Time: _____________
- End Time: _____________
- Downtime: _____________

**Deployment Team**:
- Lead: _____________
- Developer: _____________
- QA: _____________
- Admin: _____________
