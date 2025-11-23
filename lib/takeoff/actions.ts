"use server"

import { MeasurementType, MeasurementUnit } from "@prisma/client"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

export type MeasurementDTO = {
  id: string
  planSheetId: string
  detectedElementId?: string | null
  measurementType: MeasurementType
  unit: MeasurementUnit
  value: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type MeasurementRollup = {
  measurementType: MeasurementType
  unit: MeasurementUnit
  total: number
  count: number
}

export type MeasurementPayload = {
  measurements: MeasurementDTO[]
  rollup: MeasurementRollup[]
}

export type SaveMeasurementInput = {
  tenderId: string
  planSheetId: string
  detectedElementId?: string | null
  measurementId?: string
  measurementType: MeasurementType
  unit: MeasurementUnit
  value: number
  notes?: string | null
}

export type DeleteMeasurementInput = {
  tenderId: string
  planSheetId: string
  measurementId: string
}

export type DetectionReviewInput = {
  tenderId: string
  planSheetId: string
  detectionId: string
}

async function ensureSessionUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  return session.user
}

async function validatePlanSheetAccess(tenderId: string, planSheetId: string) {
  const planSheet = await prisma.planSheet.findUnique({
    where: { id: planSheetId },
    include: {
      Package: {
        select: { tenderId: true },
      },
    },
  })

  if (!planSheet) {
    throw new Error("Plan sheet not found")
  }

  const owningTenderId = (planSheet as { tenderId?: string }).tenderId ?? planSheet.Package?.tenderId

  if (!owningTenderId || owningTenderId !== tenderId) {
    throw new Error("Plan sheet does not belong to tender")
  }

  return planSheet
}

async function validateDetectionAccess({
  tenderId,
  planSheetId,
  detectionId,
}: DetectionReviewInput) {
  const detection = await prisma.detectedElement.findUnique({
    where: { id: detectionId },
  })

  if (!detection) {
    throw new Error("Detection not found")
  }

  if (detection.planSheetId !== planSheetId) {
    throw new Error("Detection does not belong to plan sheet")
  }

  await validatePlanSheetAccess(tenderId, planSheetId)

  return detection
}

function serializeMeasurement(measurement: {
  id: string
  planSheetId: string
  detectedElementId: string | null
  measurementType: MeasurementType
  unit: MeasurementUnit
  value: any
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): MeasurementDTO {
  return {
    id: measurement.id,
    planSheetId: measurement.planSheetId,
    detectedElementId: measurement.detectedElementId,
    measurementType: measurement.measurementType,
    unit: measurement.unit,
    value: Number(measurement.value),
    notes: measurement.notes,
    createdAt: measurement.createdAt.toISOString(),
    updatedAt: measurement.updatedAt.toISOString(),
  }
}

async function getRollup(planSheetId: string): Promise<MeasurementRollup[]> {
  const aggregates = await prisma.measurement.groupBy({
    by: ["measurementType", "unit"],
    where: { planSheetId },
    _sum: { value: true },
    _count: { _all: true },
  })

  return aggregates.map((aggregate) => ({
    measurementType: aggregate.measurementType,
    unit: aggregate.unit,
    total: Number(aggregate._sum.value ?? 0),
    count: aggregate._count._all,
  }))
}

async function getMeasurements(planSheetId: string): Promise<MeasurementDTO[]> {
  const measurements = await prisma.measurement.findMany({
    where: { planSheetId },
    orderBy: { createdAt: "desc" },
  })

  return measurements.map(serializeMeasurement)
}

async function buildPayload(planSheetId: string): Promise<MeasurementPayload> {
  const [measurements, rollup] = await Promise.all([
    getMeasurements(planSheetId),
    getRollup(planSheetId),
  ])

  return { measurements, rollup }
}

export async function listMeasurements(params: {
  tenderId: string
  planSheetId: string
}): Promise<MeasurementPayload> {
  await ensureSessionUser()
  await validatePlanSheetAccess(params.tenderId, params.planSheetId)

  return buildPayload(params.planSheetId)
}

export async function saveMeasurement(input: SaveMeasurementInput): Promise<MeasurementPayload> {
  await ensureSessionUser()
  await validatePlanSheetAccess(input.tenderId, input.planSheetId)

  if (input.detectedElementId) {
    const detection = await prisma.detectedElement.findUnique({
      where: { id: input.detectedElementId },
    })

    if (!detection || detection.planSheetId !== input.planSheetId) {
      throw new Error("Detection not found for plan sheet")
    }
  }

  if (input.measurementId) {
    const existing = await prisma.measurement.findUnique({ where: { id: input.measurementId } })

    if (!existing || existing.planSheetId !== input.planSheetId) {
      throw new Error("Measurement not found for plan sheet")
    }
  }

  await prisma.$transaction(async (tx) => {
    if (input.measurementId) {
      await tx.measurement.update({
        where: { id: input.measurementId },
        data: {
          detectedElementId: input.detectedElementId,
          measurementType: input.measurementType,
          unit: input.unit,
          value: input.value,
          notes: input.notes,
        },
      })
    } else {
      await tx.measurement.create({
        data: {
          planSheetId: input.planSheetId,
          detectedElementId: input.detectedElementId,
          measurementType: input.measurementType,
          unit: input.unit,
          value: input.value,
          notes: input.notes,
        },
      })
    }
  })

  return buildPayload(input.planSheetId)
}

export async function deleteMeasurement(input: DeleteMeasurementInput): Promise<MeasurementPayload> {
  await ensureSessionUser()
  await validatePlanSheetAccess(input.tenderId, input.planSheetId)

  const existing = await prisma.measurement.findUnique({ where: { id: input.measurementId } })

  if (!existing || existing.planSheetId !== input.planSheetId) {
    throw new Error("Measurement not found for plan sheet")
  }

  await prisma.measurement.delete({ where: { id: input.measurementId } })

  return buildPayload(input.planSheetId)
}

async function updateDetectionLabel(
  input: DetectionReviewInput,
  label: "APPROVED" | "REJECTED",
) {
  await ensureSessionUser()
  await validateDetectionAccess(input)

  const detection = await prisma.detectedElement.update({
    where: { id: input.detectionId },
    data: { label },
  })

  return detection
}

export async function approveDetection(input: DetectionReviewInput) {
  return updateDetectionLabel(input, "APPROVED")
}

export async function rejectDetection(input: DetectionReviewInput) {
  return updateDetectionLabel(input, "REJECTED")
}
