
# Quotation PDF Export with NAS Storage

This document describes the automatic PDF download and NAS storage functionality implemented in the business management system.

## Features Implemented

### 1. Automatic PDF Download
- ✅ **One-Click Export**: Click "Export PDF" button to automatically download quotation PDFs
- ✅ **Smart Filename Generation**: PDFs are named using configurable conventions
- ✅ **Progress Feedback**: Loading notifications and success/error messages
- ✅ **Fallback Generation**: If no stored PDF exists, generates new one on-demand

### 2. NAS Storage Integration
- ✅ **Automatic NAS Backup**: PDFs are automatically saved to Network Attached Storage
- ✅ **Organized Folder Structure**: Files organized by client and project folders
- ✅ **Configurable Settings**: Enable/disable NAS storage through settings page
- ✅ **Connection Testing**: Built-in NAS connection test functionality

### 3. Configurable File Naming
The system uses a flexible naming convention that can be customized. Default format:
```
{quotationNumber}.{clientName}.{projectName}.{title}.pdf
```

Example output:
```
AMP-Q-2025-001.ABC Construction.Marina Bay Project.Electrical Installation.pdf
```

## Configuration

### NAS Storage Settings
Navigate to **Settings > System** and configure the NAS Storage section:

1. **Enable NAS Storage**: Toggle to enable automatic NAS backup
2. **NAS Path**: Network path to your storage location
   - Example: `/mnt/nas/quotations` (Linux)
   - Example: `//192.168.1.100/shared/quotations` (Windows/SMB)
3. **Organize Folders**: Enable to create client/project folder structure
4. **Naming Convention**: Customize the filename pattern using these variables:
   - `{quotationNumber}`: The quotation reference number
   - `{clientName}`: Client/customer name
   - `{projectName}`: Project or tender name
   - `{title}`: Quotation title

### Example NAS Configuration
```json
{
  "storage": {
    "nasEnabled": true,
    "nasPath": "/home/ubuntu/ampere_business_management/nas_storage",
    "organizeFolders": true,
    "namingConvention": "{quotationNumber}.{clientName}.{projectName}.{title}",
    "autoDownload": true
  }
}
```

## Folder Structure (when organized folders enabled)
```
NAS_PATH/
├── ABC Construction/
│   ├── Marina Bay Project/
│   │   ├── AMP-Q-2025-001.ABC Construction.Marina Bay Project.Electrical Installation.pdf
│   │   └── AMP-Q-2025-002.ABC Construction.Marina Bay Project.HVAC Systems.pdf
│   └── Orchard Tower Renovation/
│       └── AMP-Q-2025-003.ABC Construction.Orchard Tower Renovation.Lighting Upgrade.pdf
└── XYZ Engineering/
    └── Sentosa Resort/
        └── AMP-Q-2025-004.XYZ Engineering.Sentosa Resort.Power Distribution.pdf
```

## User Experience

### For Regular Users
1. **Export PDF**: Navigate to Quotations page
2. **Click Export**: Find the quotation and click the "Export PDF" button from the dropdown menu
3. **Automatic Download**: PDF automatically downloads to your computer
4. **Background Storage**: If NAS is configured, PDF is automatically backed up to network storage

### For Administrators
1. **Configure Settings**: Access Settings > System to configure NAS storage
2. **Test Connection**: Use the "Test NAS Connection" button to verify setup
3. **Monitor Activity**: Check quotation activity logs for export records
4. **File Organization**: Set up folder structure and naming conventions

## API Endpoints

### Download PDF
```
GET /api/quotations/[id]/download-pdf
```
- Downloads quotation PDF directly to user's computer
- Automatically saves to NAS if configured
- Generates PDF if none exists
- Logs export activity

### Test Export (Development)
```
GET /api/quotations/[id]/test-export
```
- Test endpoint for verifying quotation data
- Available for SUPERADMIN, ADMIN, PROJECT_MANAGER roles only

### Settings Management
```
GET /api/settings
PUT /api/settings
POST /api/settings/test-nas
```
- Manage system configuration including NAS settings
- Test NAS connectivity
- SUPERADMIN access required

## Technical Implementation

### Key Files
- **API Route**: `/app/api/quotations/[id]/download-pdf/route.ts`
- **NAS Utilities**: `/lib/nas-storage.ts`
- **PDF Generator**: `/lib/pdf-generator.ts`
- **Settings Management**: `/app/api/settings/route.ts`
- **Frontend Component**: `/app/quotations/page.tsx`

### Dependencies
- **jsPDF**: PDF generation library
- **Node.js fs/promises**: File system operations
- **Prisma**: Database operations and activity logging
- **Next.js**: API routes and server-side functionality

### Security & Permissions
- **Authentication**: Requires valid user session
- **Role-based Access**: Export available to authorized users
- **File Safety**: Sanitized filenames prevent directory traversal
- **Error Handling**: Comprehensive error logging and user feedback

## Troubleshooting

### Common Issues

1. **PDF Download Not Starting**
   - Check browser permissions for automatic downloads
   - Verify user has export permissions for the quotation
   - Check console for JavaScript errors

2. **NAS Storage Not Working**
   - Verify NAS path is accessible from server
   - Test NAS connection using Settings > Test Connection
   - Check file system permissions on NAS path

3. **Incorrect Filenames**
   - Review naming convention in Settings
   - Ensure all template variables are properly formatted
   - Check for special characters in quotation data

4. **Large PDF Files**
   - PDFs with many items may take longer to generate
   - Check server memory and processing capacity
   - Consider optimizing image assets in letterhead

### Error Messages

- **"Quotation not found"**: Invalid quotation ID or deleted record
- **"NAS connection failed"**: Network path inaccessible or permission issues
- **"Failed to generate PDF"**: Server-side PDF generation error
- **"Unauthorized"**: User session expired or insufficient permissions

## Maintenance

### Regular Tasks
1. **Monitor NAS Storage**: Check disk space and folder organization
2. **Review Activity Logs**: Monitor export frequency and errors
3. **Update Settings**: Adjust naming conventions as business needs change
4. **Test Functionality**: Periodically verify export and NAS functionality

### Performance Optimization
- **PDF Caching**: System reuses existing PDFs when available
- **Background Processing**: NAS saves don't block user downloads
- **Error Recovery**: Fallback to PDF generation if stored version unavailable

## Future Enhancements
- Email delivery of PDFs
- Batch export functionality
- PDF watermarking options
- Advanced folder organization rules
- Cloud storage integration (AWS S3, Google Drive, etc.)

---

**Note**: This functionality requires proper server configuration and NAS setup. Contact your system administrator for network storage configuration assistance.
