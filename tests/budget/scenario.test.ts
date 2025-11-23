import assert from 'node:assert'
import { describe, it, beforeEach } from 'node:test'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { saveScenario, listScenarios, applyScenarioSnapshot } from '../../lib/budget/scenarios.ts'
import { BudgetForecast } from '../../lib/budget/forecast.ts'

let tempFile: string

beforeEach(async () => {
  tempFile = path.join(os.tmpdir(), `scenario-${Date.now()}.json`)
  process.env.BUDGET_SCENARIO_STORAGE = tempFile
  await fs.rm(tempFile, { force: true })
})

describe('scenario persistence', () => {
  it('saves and filters scenarios by project', async () => {
    const baseline: BudgetForecast = {
      projectId: 'project-1',
      projectName: 'Project 1',
      totalBudget: 10000,
      totalActual: 4000,
      remainingBudget: 6000,
      burnRate: {
        burnRatePerDay: 200,
        projectedAtCompletion: 9000,
        varianceToBudget: 1000,
        daysRemaining: 30
      },
      categories: [],
      monthlyActuals: []
    }

    const saved = await saveScenario({
      name: 'Upside case',
      projectId: 'project-1',
      adjustments: { percentageChange: 5, purchaseOrderImpact: 200 },
      baseline
    })

    assert.ok(saved.snapshot)
    const scenarios = await listScenarios('project-1')
    assert.equal(scenarios.length, 1)
    assert.equal(scenarios[0].name, 'Upside case')
    assert.equal(Math.round((scenarios[0].snapshot?.totalBudget ?? 0) * 100) / 100, 10700)
  })
})

describe('scenario application', () => {
  it('applies adjustments to baseline totals', () => {
    const baseline: BudgetForecast = {
      projectId: 'p2',
      projectName: 'Project 2',
      totalBudget: 8000,
      totalActual: 3000,
      remainingBudget: 5000,
      burnRate: {
        burnRatePerDay: 100,
        projectedAtCompletion: 7000,
        varianceToBudget: 1000,
        daysRemaining: 40
      },
      categories: [],
      monthlyActuals: []
    }

    const result = applyScenarioSnapshot(baseline, {
      percentageChange: 20,
      hiringHeadcount: 2,
      hiringCostPerHead: 500
    })

    assert.equal(result.totalBudget, 9600)
    assert.equal(result.totalActual, 4000)
  })
})
