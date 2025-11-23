import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const presetSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const presets = await prisma.invoiceBrandingPreset.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ presets })
  } catch (error) {
    console.error("GET /api/invoices/branding error", error)
    return NextResponse.json({ error: "Failed to load branding presets" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const data = presetSchema.parse(body)

    const preset = await prisma.invoiceBrandingPreset.create({
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        terms: data.terms,
      },
    })

    return NextResponse.json(preset, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    console.error("POST /api/invoices/branding error", error)
    return NextResponse.json({ error: "Failed to save branding preset" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"
