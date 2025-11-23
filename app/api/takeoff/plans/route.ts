import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadPlanFile } from '@/lib/s3'
import { extractPlanMetadata } from '@/lib/takeoff/plan-ingestion'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const tenderId = formData.get('tenderId')?.toString()
  const scaleValue = formData.get('scale')?.toString()
  const units = formData.get('units')?.toString() || null

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!tenderId) {
    return NextResponse.json({ error: 'Tender ID is required' }, { status: 400 })
  }

  const tender = await prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } })

  if (!tender) {
    return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { pageCount, dpi } = await extractPlanMetadata(buffer)
  const uploadResult = await uploadPlanFile(buffer, file.name)

  const planSheet = await prisma.planSheet.create({
    data: {
      tenderId,
      name: file.name,
      fileKey: uploadResult.key,
      pageCount,
      dpi,
      scale: scaleValue ? Number(scaleValue) : null,
      units,
    },
  })

  return NextResponse.json({
    ...planSheet,
    fileUrl: uploadResult.url,
  })
}
