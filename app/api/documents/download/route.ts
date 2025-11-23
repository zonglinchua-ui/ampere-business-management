
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { downloadFile } from "@/lib/s3"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const key = url.searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: "Document key is required" }, { status: 400 })
    }

    // Generate signed URL for download
    const downloadUrl = await downloadFile(key)

    // Redirect to the signed URL for direct download
    return NextResponse.redirect(downloadUrl)

  } catch (error) {
    console.error("Error generating download URL:", error)
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    )
  }
}
