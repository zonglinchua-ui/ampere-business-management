import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BrandingPreset } from "@/lib/invoices/branding"
import { buildBrandingStyles } from "@/lib/invoices/branding"

interface InvoiceBrandingPreviewProps {
  preset?: BrandingPreset | null
  title?: string
  customerName?: string
  totalAmount?: number
}

export function InvoiceBrandingPreview({ preset, title = "Invoice", customerName = "Customer", totalAmount = 0 }: InvoiceBrandingPreviewProps) {
  const branding = buildBrandingStyles(preset)

  return (
    <Card className="border border-dashed">
      <CardHeader style={branding.headerStyle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">{title}</CardTitle>
          {branding.logoUrl && (
            <div className="relative h-10 w-24">
              <Image src={branding.logoUrl} alt={`${preset?.name || "Brand"} logo`} fill className="object-contain" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bill to</span>
          <span className="font-semibold" style={branding.accentStyle}>{customerName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold" style={branding.accentStyle}>
            ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {branding.terms && <p className="text-xs text-muted-foreground">{branding.terms}</p>}
      </CardContent>
    </Card>
  )
}
