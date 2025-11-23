import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBurnRateProjection, projectScenarioFromAdjustments, BudgetForecast } from '../../lib/budget/forecast.ts'

describe('budget forecast calculations', () => {
  it('computes burn-rate projections using elapsed and remaining days', () => {
    const projection = computeBurnRateProjection({
      totalBudget: 10000,
      totalActual: 3000,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      today: new Date('2024-01-11')
    })

    assert.equal(Math.round(projection.burnRatePerDay), 300)
    assert.equal(projection.daysRemaining, 21)
    assert.equal(Math.round(projection.projectedAtCompletion), 9300)
    assert.equal(Math.round(projection.varianceToBudget), 700)
  })

  it('applies scenario adjustments to baseline totals', () => {
    const baseline: BudgetForecast = {
      projectId: 'p1',
      projectName: 'Sample',
      totalBudget: 5000,
      totalActual: 2000,
      remainingBudget: 3000,
      burnRate: {
        burnRatePerDay: 100,
        projectedAtCompletion: 4000,
        varianceToBudget: 1000,
        daysRemaining: 20
      },
      categories: [],
      monthlyActuals: []
    }

    const adjusted = projectScenarioFromAdjustments(baseline, {
      percentageChange: 10,
      purchaseOrderImpact: 500,
      hiringHeadcount: 1,
      hiringCostPerHead: 1000
    })

    assert.equal(adjusted.totalBudget, 6000)
    assert.equal(adjusted.totalActual, 3000)
    assert.equal(adjusted.remainingBudget, 3000)
  })
})
