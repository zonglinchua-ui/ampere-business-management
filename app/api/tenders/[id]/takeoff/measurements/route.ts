import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { MeasurementUnit, Prisma } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import {
  evaluateCostMappingFormula,
  normalizeFormulaInputs,
  type FormulaDefinition,
  type FormulaEvaluationResult,
} from "@/lib/cost-mapping/formulas"

interface MappingSummary {
  id: string
  planSheetId: string
  detectedElementId: string
  measurementId?: string | null
  derivedValue?: number | null
  derivedUnit?: MeasurementUnit | null
  outputName?: string
  formulaExpression?: string | null
  formulaOutputUnit?: MeasurementUnit | null
  formulaError?: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenderId = params.id

  const planSheets = await prisma.planSheet.findMany({
    where: { Package: { tenderId } },
    include: {
      Measurements: true,
      DetectedElements: {
        include: {
          CostMappings: {
            include: { Measurement: true },
          },
        },
      },
    },
  })

  const mappingResults: MappingSummary[] = []
  const updates: Prisma.PrismaPromise<unknown>[] = []

  for (const sheet of planSheets) {
    for (const element of sheet.DetectedElements) {
      for (const mapping of element.CostMappings) {
        const inputs = normalizeFormulaInputs(mapping.formulaInputs)
        const definition: FormulaDefinition = {
          expression: mapping.formulaExpression ?? "",
          inputs,
          outputUnit: mapping.formulaOutputUnit ?? mapping.derivedUnit ?? undefined,
        }

        const evaluation: FormulaEvaluationResult = definition.expression
          ? evaluateCostMappingFormula(definition, {
              measurement: mapping.Measurement
                ? {
                    ...mapping.Measurement,
                    value: Number(mapping.Measurement.value),
                  }
                : undefined,
              element,
            })
          : { error: "No formula expression configured" }

        const derivedValue = evaluation.value ?? null
        const derivedUnit = evaluation.unit ?? mapping.formulaOutputUnit ?? mapping.derivedUnit ?? null
        const formulaError = evaluation.error ?? null

        mappingResults.push({
          id: mapping.id,
          planSheetId: sheet.id,
          detectedElementId: element.id,
          measurementId: mapping.measurementId,
          derivedValue,
          derivedUnit,
          outputName: evaluation.outputName,
          formulaExpression: mapping.formulaExpression,
          formulaOutputUnit: mapping.formulaOutputUnit,
          formulaError,
        })

        updates.push(
          prisma.costMapping.update({
            where: { id: mapping.id },
            data: {
              derivedValue: derivedValue !== null ? new Prisma.Decimal(derivedValue) : null,
              derivedUnit,
              formulaError,
            },
          }),
        )
      }
    }
  }

  if (updates.length) {
    await prisma.$transaction(updates)
  }

  const derivedByMeasurement = new Map<string, MappingSummary[]>()

  for (const mapping of mappingResults) {
    if (mapping.measurementId) {
      const existing = derivedByMeasurement.get(mapping.measurementId) ?? []
      existing.push(mapping)
      derivedByMeasurement.set(mapping.measurementId, existing)
    }
  }

  const measurements = planSheets.flatMap((sheet) =>
    sheet.Measurements.map((measurement) => ({
      id: measurement.id,
      sheetId: sheet.id,
      label: measurement.notes ?? measurement.measurementType,
      value: Number(measurement.value),
      unit: measurement.unit,
      annotation: measurement.notes ?? undefined,
      derived:
        derivedByMeasurement
          .get(measurement.id)
          ?.map((mapping) => ({
            mappingId: mapping.id,
            label: mapping.outputName ?? mapping.formulaExpression ?? "Derived quantity",
            value: mapping.derivedValue ?? undefined,
            unit: mapping.derivedUnit ?? undefined,
            error: mapping.formulaError ?? undefined,
          })) ?? [],
    })),
  )

  return NextResponse.json({ measurements, mappings: mappingResults })
}
