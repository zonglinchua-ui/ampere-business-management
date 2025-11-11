
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAllTemplates, getTemplatesByCategory, getTemplateByType } from "@/lib/document-templates"
import { ProjectDocumentCategory, ProjectDocumentType, TemplateType } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') as ProjectDocumentCategory | null
    const templateType = searchParams.get('type') as ProjectDocumentType | null

    let templates
    
    if (templateType) {
      const template = getTemplateByType(templateType)
      templates = template ? [template] : []
    } else if (category) {
      templates = getTemplatesByCategory(category)
    } else {
      templates = getAllTemplates()
    }

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching document templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch document templates" },
      { status: 500 }
    )
  }
}
