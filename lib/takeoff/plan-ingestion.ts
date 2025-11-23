import pdfParse from 'pdf-parse'

export interface PlanMetadata {
  pageCount: number
  dpi: number | null
}

/**
 * Extracts useful plan metadata from a PDF buffer.
 * - page count via pdf-parse's numpages output
 * - DPI derived from PDF userUnit (defaults to 72 points per inch)
 */
export async function extractPlanMetadata(buffer: Buffer): Promise<PlanMetadata> {
  let derivedDpi: number | null = null

  const result = await pdfParse(buffer, {
    pagerender: (pageData) => {
      const pageInfo: any = (pageData as any).pageInfo || (pageData as any)._pageInfo
      const userUnit = pageInfo?.userUnit || 1
      const dpiEstimate = Math.round(72 * userUnit)

      if (!derivedDpi || dpiEstimate > derivedDpi) {
        derivedDpi = dpiEstimate
      }

      return Promise.resolve('')
    },
  })

  return {
    pageCount: result.numpages || 0,
    dpi: derivedDpi,
  }
}
