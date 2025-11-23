import fs from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { BudgetForecast, projectScenarioFromAdjustments } from './forecast'

export interface ScenarioAdjustment {
  percentageChange?: number
  hiringHeadcount?: number
  purchaseOrderImpact?: number
  hiringCostPerHead?: number
  notes?: string
}

export interface BudgetScenario {
  id: string
  name: string
  projectId?: string
  adjustments: ScenarioAdjustment
  snapshot?: BudgetForecast
  createdAt: string
  updatedAt: string
}

function getScenarioPath() {
  const storageOverride = process.env.BUDGET_SCENARIO_STORAGE
  const storageDir = storageOverride ? path.dirname(storageOverride) : path.join(process.cwd(), 'storage')
  const filename = storageOverride ? path.basename(storageOverride) : 'budget-scenarios.json'
  return path.join(storageDir, filename)
}

async function readScenarioFile(): Promise<BudgetScenario[]> {
  const filePath = getScenarioPath()
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as BudgetScenario[]
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, '[]', 'utf-8')
      return []
    }
    throw error
  }
}

async function writeScenarioFile(data: BudgetScenario[]) {
  const filePath = getScenarioPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function listScenarios(projectId?: string) {
  const scenarios = await readScenarioFile()
  if (!projectId) return scenarios
  return scenarios.filter((scenario) => scenario.projectId === projectId)
}

export async function saveScenario(params: {
  name: string
  projectId?: string
  adjustments: ScenarioAdjustment
  baseline?: BudgetForecast
}): Promise<BudgetScenario> {
  const scenarios = await readScenarioFile()
  const now = new Date().toISOString()
  const scenario: BudgetScenario = {
    id: uuid(),
    name: params.name,
    projectId: params.projectId,
    adjustments: params.adjustments,
    snapshot: params.baseline
      ? projectScenarioFromAdjustments(params.baseline, params.adjustments)
      : undefined,
    createdAt: now,
    updatedAt: now
  }

  scenarios.push(scenario)
  await writeScenarioFile(scenarios)
  return scenario
}

export async function updateScenario(id: string, updates: Partial<BudgetScenario>) {
  const scenarios = await readScenarioFile()
  const idx = scenarios.findIndex((s) => s.id === id)
  if (idx === -1) {
    throw new Error('Scenario not found')
  }
  const updated = { ...scenarios[idx], ...updates, updatedAt: new Date().toISOString() }
  scenarios[idx] = updated
  await writeScenarioFile(scenarios)
  return updated
}

export function applyScenarioSnapshot(base: BudgetForecast, adjustments: ScenarioAdjustment) {
  return projectScenarioFromAdjustments(base, adjustments)
}
