import { MeasurementUnit } from "@prisma/client"

export type FormulaVariableSource = "measurement" | "element"

export interface FormulaInputDefinition {
  name: string
  source: FormulaVariableSource
  path?: string
  unit?: MeasurementUnit
  required?: boolean
}

export interface FormulaDefinition {
  expression: string
  inputs: FormulaInputDefinition[]
  outputUnit?: MeasurementUnit
}

export interface FormulaEvaluationContext {
  measurement?: { value: number; unit?: MeasurementUnit } & Record<string, unknown>
  element?: Record<string, unknown>
}

export interface FormulaEvaluationResult {
  value?: number
  unit?: MeasurementUnit
  outputName?: string
  error?: string
}

type MeasurementDimension = "length" | "area" | "count" | null

const UNIT_DIMENSION: Record<MeasurementUnit, MeasurementDimension> = {
  [MeasurementUnit.METER]: "length",
  [MeasurementUnit.FOOT]: "length",
  [MeasurementUnit.SQUARE_METER]: "area",
  [MeasurementUnit.SQUARE_FOOT]: "area",
  [MeasurementUnit.COUNT]: "count",
  [MeasurementUnit.ITEM]: "count",
}

const UNIT_FACTOR: Record<MeasurementUnit, number> = {
  [MeasurementUnit.METER]: 1,
  [MeasurementUnit.FOOT]: 0.3048,
  [MeasurementUnit.SQUARE_METER]: 1,
  [MeasurementUnit.SQUARE_FOOT]: 0.092903,
  [MeasurementUnit.COUNT]: 1,
  [MeasurementUnit.ITEM]: 1,
}

const BASE_UNIT: Record<Exclude<MeasurementDimension, null>, MeasurementUnit> = {
  length: MeasurementUnit.METER,
  area: MeasurementUnit.SQUARE_METER,
  count: MeasurementUnit.COUNT,
}

function getDimension(unit?: MeasurementUnit | null): MeasurementDimension {
  if (!unit) return null
  return UNIT_DIMENSION[unit]
}

function convertUnit(value: number, fromUnit: MeasurementUnit, toUnit: MeasurementUnit): number {
  if (fromUnit === toUnit) return value

  const fromDimension = getDimension(fromUnit)
  const toDimension = getDimension(toUnit)

  if (!fromDimension || !toDimension || fromDimension !== toDimension) {
    throw new Error(`Units ${fromUnit} and ${toUnit} are not compatible`)
  }

  const fromFactor = UNIT_FACTOR[fromUnit]
  const toFactor = UNIT_FACTOR[toUnit]

  return (value * fromFactor) / toFactor
}

function getBaseUnitFor(unit?: MeasurementUnit | null): MeasurementUnit | undefined {
  const dimension = getDimension(unit)
  if (!dimension) return undefined
  return BASE_UNIT[dimension]
}

function getPathValue(payload: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[key]
    }
    return undefined
  }, payload)
}

function resolveInputValue(
  input: FormulaInputDefinition,
  context: FormulaEvaluationContext,
): { value: number; unit?: MeasurementUnit } {
  const targetName = input.name?.trim()
  if (!targetName) {
    throw new Error("Formula input is missing a variable name")
  }

  if (input.source === "measurement") {
    if (!context.measurement) {
      throw new Error(`Measurement context missing for ${targetName}`)
    }

    const numericValue = Number(context.measurement.value)
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Measurement value for ${targetName} is not numeric`)
    }

    const actualUnit = context.measurement.unit
    const desiredUnit = input.unit ?? actualUnit

    if (desiredUnit && actualUnit && getDimension(desiredUnit) !== getDimension(actualUnit)) {
      throw new Error(
        `Unit mismatch for ${targetName}: cannot convert ${actualUnit} to ${desiredUnit}`,
      )
    }

    const value =
      desiredUnit && actualUnit && desiredUnit !== actualUnit
        ? convertUnit(numericValue, actualUnit, desiredUnit)
        : numericValue

    return { value, unit: desiredUnit ?? actualUnit }
  }

  if (!context.element) {
    throw new Error(`Detected element context missing for ${targetName}`)
  }

  const raw = getPathValue(context.element, input.path ?? input.name)
  const numericValue = Number(raw)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Element attribute for ${targetName} is not numeric`)
  }

  return { value: numericValue, unit: input.unit }
}

function sanitizeExpression(expression: string, allowedVars: Set<string>): string {
  const cleaned = expression.replace(/\s+/g, " ").trim()
  const invalidToken = /[^0-9+\-*/(). _A-Za-z]/

  if (invalidToken.test(cleaned)) {
    throw new Error("Formula contains unsupported characters")
  }

  const identifiers = cleaned.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
  const unknown = identifiers.filter((token) => !allowedVars.has(token))

  if (unknown.length) {
    throw new Error(`Unknown variables in formula: ${unknown.join(", ")}`)
  }

  return cleaned
}

function evaluateMathExpression(expression: string, variables: Record<string, number>): number {
  const allowedVars = new Set(Object.keys(variables))
  const safeExpression = sanitizeExpression(expression, allowedVars)
  const variableNames = Array.from(allowedVars)
  const evaluator = new Function(...variableNames, `"use strict"; return ${safeExpression};`)
  const result = evaluator(...variableNames.map((key) => variables[key]))

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Formula evaluation did not return a finite number")
  }

  return result
}

function parseFormula(rawExpression: string): { outputName?: string; expression: string } {
  const trimmed = rawExpression.trim()
  const eqIndex = trimmed.indexOf("=")

  if (eqIndex === -1) {
    return { expression: trimmed }
  }

  const outputName = trimmed.slice(0, eqIndex).trim()
  const expression = trimmed.slice(eqIndex + 1).trim()

  return { outputName: outputName || undefined, expression }
}

export function normalizeFormulaInputs(value: unknown): FormulaInputDefinition[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const typed = entry as Partial<FormulaInputDefinition>

      if (!typed.name || !typed.source) return null

      return {
        name: typed.name,
        source: typed.source,
        path: typed.path,
        unit: typed.unit,
        required: typed.required ?? true,
      }
    })
    .filter((entry): entry is FormulaInputDefinition => Boolean(entry))
}

export function evaluateCostMappingFormula(
  definition: FormulaDefinition,
  context: FormulaEvaluationContext,
): FormulaEvaluationResult {
  if (!definition.expression?.trim()) {
    return { error: "Formula expression is not defined" }
  }

  const parsed = parseFormula(definition.expression)
  const resolvedInputs: Record<string, { value: number; unit?: MeasurementUnit }> = {}
  const inputUnits: Array<MeasurementUnit | undefined> = []

  for (const input of definition.inputs) {
    try {
      const resolved = resolveInputValue(input, context)
      resolvedInputs[input.name] = resolved
      inputUnits.push(resolved.unit)
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to resolve input", outputName: parsed.outputName }
    }
  }

  const missing = definition.inputs
    .filter((input) => (input.required ?? true) && resolvedInputs[input.name] === undefined)
    .map((input) => input.name)

  if (missing.length) {
    return { error: `Missing required inputs: ${missing.join(", ")}`, outputName: parsed.outputName }
  }

  const variables = Object.fromEntries(
    Object.entries(resolvedInputs).map(([key, entry]) => [key, entry.value]),
  )

  try {
    const rawValue = evaluateMathExpression(parsed.expression, variables)
    const outputUnit = definition.outputUnit ?? inputUnits.find(Boolean)

    if (!outputUnit) {
      return { value: rawValue, unit: undefined, outputName: parsed.outputName }
    }

    const baseUnit = getBaseUnitFor(outputUnit)
    const result = baseUnit ? convertUnit(rawValue, baseUnit, outputUnit) : rawValue

    return { value: result, unit: outputUnit, outputName: parsed.outputName }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to evaluate formula", outputName: parsed.outputName }
  }
}
