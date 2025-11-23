import type { CSSProperties } from "react"

export interface BrandingPreset {
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  terms?: string | null
}

export interface BrandingStyles {
  headerStyle: CSSProperties
  accentStyle: CSSProperties
  terms: string | undefined
  logoUrl?: string
}

export function buildBrandingStyles(preset?: BrandingPreset | null): BrandingStyles {
  const primaryColor = preset?.primaryColor || "#0f172a"
  const accentColor = preset?.accentColor || "#1d4ed8"

  return {
    headerStyle: {
      backgroundColor: primaryColor,
      color: "#ffffff",
      borderBottom: `4px solid ${accentColor}`,
    },
    accentStyle: {
      color: accentColor,
    },
    terms: preset?.terms || undefined,
    logoUrl: preset?.logoUrl || undefined,
  }
}
