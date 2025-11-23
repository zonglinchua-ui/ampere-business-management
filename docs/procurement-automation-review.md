# Procurement Document Processing Review

## Current Workflow
- **Upload endpoint:** `app/api/projects/[id]/procurement/upload/route.ts` saves procurement documents to NAS, stores metadata in `procurementDocument` with `PENDING_EXTRACTION` status, and enqueues an extraction job. Auto-detection of type uses filename heuristics when the client sends `documentType=AUTO`.【F:app/api/projects/[id]/procurement/upload/route.ts†L38-L125】
- **Extraction queue:** `lib/extraction-queue.ts` runs an in-memory FIFO queue that dynamically loads the processor and marks job status. No persistence or retry/backoff exists, and completed jobs are cleared after five minutes.【F:lib/extraction-queue.ts†L1-L86】
- **Vision extraction:** `lib/extraction-processor.ts` converts PDFs/images to PNG, calls the local Ollama vision model (`llama3.2-vision`) with structured prompts per document type, parses JSON/markdown responses, and writes `EXTRACTED` or `FAILED` status plus confidence and mismatch flags to `procurementDocument`.【F:lib/extraction-processor.ts†L11-L205】【F:lib/extraction-processor.ts†L238-L353】
- **PO approval and generation:** When approving a PO request the API builds and stores a PDF, creates a `procurementDocument` entry, copies line items, and updates approval history. This flow assumes the PO request already exists and is linked to a project and quotation; it does not derive data from uploaded PO documents.【F:app/api/projects/[id]/procurement/approve-po/route.ts†L11-L213】【F:app/api/projects/[id]/procurement/approve-po/route.ts†L214-L317】

## Observations & Gaps
- Document ingestion is project-scoped; uploads require a project ID and there is no path to spawn a new project or maintenance contract from an incoming PO.
- Extraction outputs are stored but not mapped to domain entities (projects/contracts/customers) beyond a `projectMismatch` flag. No auto-linking creates suppliers/clients or updates budgets.
- Queue is volatile and single-process; restarts drop jobs and there is no visibility or retries for failed/long-running extractions.
- File-type detection is filename-based and may misclassify scanned POs lacking "PO" in the name; there is no content-based fallback using the vision model.
- No downstream automation uses extracted dates/amounts to set project handover dates, contract values, or client info.

## Recommendations for Smooth Automation
1. **Allow PO-first ingestion**
   - Add an unaffiliated upload route (e.g., `/api/procurement/ingest`) that accepts POs, runs extraction, and decides whether to create a **Project** or **MaintenanceContract** based on keywords like "maintenance", service periods, or recurring terms.
   - After extraction, create or match clients (by name/email/domain), then create the project/contract with fields: `name`, `projectNumber`/`contractNumber`, `clientId`, `handoverDate` (from `deliveryDate`/`dueDate`), `contractValue` (from `totalAmount`), and `projectReference`.

2. **Extraction-to-entity mapping**
   - Extend `processExtraction` to call a mapper that:
     - Normalizes supplier/customer names, currency, and dates.
     - Matches existing projects by `projectReference`/`projectName` or creates a new record when none match and the document type is PO.
     - Creates `procurementDocumentLineItems` directly from extracted line items.
   - Persist a `derivedEntities` column (JSON) on `procurementDocument` to store created/linked IDs for traceability.

3. **Queue durability and monitoring**
   - Swap the in-memory queue for Redis/BullMQ or Prisma-backed jobs to survive restarts, support retries, and expose status to the UI. Include exponential backoff for Ollama timeouts.

4. **Content-based type detection**
   - When `documentType` is `AUTO`, run a lightweight vision classification prompt before processing to discriminate PO vs quotation vs invoice, falling back to filename only when confidence is low.

5. **Business rule automation for POs**
   - Define a `createProjectFromPO` service that:
     - Validates confidence ≥ threshold and required fields (`documentNumber`, `totalAmount`, `customerName`).
     - Creates a project/contract draft with `status=DRAFT`, attaches the uploaded PO, and sets `handoverDate` from delivery/due dates.
     - Creates a PO record and synchronizes budgets/forecast lines based on line items.
   - Notify reviewers when `projectMismatch` is true or confidence is below threshold for manual correction.

6. **Audit and approvals**
   - Log every automatic creation/update in approval history with the extraction job ID. Provide UI diff review before finalizing project/contract creation to maintain control.

7. **Model/runtime considerations**
   - Keep Ollama model name/config in env vars to switch models without code changes. Batch PDF page images when multi-page documents are common to capture totals/dates beyond the first page.

These steps will allow a PO to trigger autonomous project/maintenance contract creation while keeping reviewers in the loop and avoiding silent failures.
