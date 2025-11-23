import { InferenceStatus } from "@prisma/client"
import { randomUUID } from "crypto"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { runTakeoffDetection } from "@/lib/takeoff/detection"

export async function POST(req: NextRequest) {
  let packageId: string | null = null

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const planSheetId = body?.planSheetId as string | undefined

    if (!planSheetId) {
      return NextResponse.json({ error: "PlanSheet ID is required" }, { status: 400 })
    }

    const planSheet = await prisma.planSheet.findUnique({
      where: { id: planSheetId },
      include: { TenderTakeoffPackage: true },
    })

    if (!planSheet) {
      return NextResponse.json({ error: "PlanSheet not found" }, { status: 404 })
    }

    packageId = planSheet.tenderTakeoffPackageId
    const version = planSheet.version + 1

    await prisma.$transaction([
      prisma.tenderTakeoffPackage.update({
        where: { id: planSheet.tenderTakeoffPackageId },
        data: { inferenceStatus: InferenceStatus.RUNNING, lastRunAt: new Date() },
      }),
      prisma.planSheet.update({
        where: { id: planSheetId },
        data: { version },
      }),
      prisma.detectedElement.deleteMany({
        where: { planSheetId, version },
      }),
    ])

    const detections = await runTakeoffDetection({
      planSheetId,
      imageUrl: planSheet.imageUrl,
      version,
      name: planSheet.name,
    })

    await prisma.$transaction([
      prisma.detectedElement.createMany({
        data: detections.map((element) => ({
          id: randomUUID(),
          planSheetId,
          type: element.type,
          polygon: element.polygon,
          boundingBox: element.boundingBox,
          confidence: element.confidence,
          version,
        })),
      }),
      prisma.planSheet.update({
        where: { id: planSheetId },
        data: { lastDetectedAt: new Date() },
      }),
      prisma.tenderTakeoffPackage.update({
        where: { id: planSheet.tenderTakeoffPackageId },
        data: { inferenceStatus: InferenceStatus.COMPLETED, lastRunAt: new Date() },
      }),
    ])

    return NextResponse.json({
      planSheetId,
      version,
      detections: detections.map((element) => ({
        type: element.type,
        polygon: element.polygon,
        boundingBox: element.boundingBox,
        confidence: element.confidence,
      })),
    })
  } catch (error) {
    console.error("Failed to run takeoff detection", error)

    if (packageId) {
      await prisma.tenderTakeoffPackage.update({
        where: { id: packageId },
        data: { inferenceStatus: InferenceStatus.FAILED },
      })
    }

    return NextResponse.json({ error: "Failed to run detection" }, { status: 500 })
  }
}
