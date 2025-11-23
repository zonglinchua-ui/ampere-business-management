import assert from 'node:assert'
import { describe, it } from 'node:test'
import { calculateVariance, triggerVarianceAlert } from '../../lib/budget/alerts.ts'

describe('variance calculations', () => {
  it('calculates variance percentages correctly', () => {
    const { variancePct, overBudgetAmount } = calculateVariance(1000, 1200)
    assert.equal(Math.round(variancePct), 20)
    assert.equal(overBudgetAmount, 200)
  })

  it('returns zero variance when both budget and actuals are zero', async () => {
    const { variancePct, overBudgetAmount } = calculateVariance(0, 0)
    assert.equal(variancePct, 0)
    assert.equal(overBudgetAmount, 0)

    const result = await triggerVarianceAlert({
      projectId: 'p0',
      totalBudget: 0,
      totalActual: 0,
      skipPersistence: true,
      disableNotifications: true
    })

    assert.equal(result.triggered, false)
    assert.equal(result.variancePct, 0)
  })

  it('skips alerts when variance below threshold', async () => {
    const result = await triggerVarianceAlert({
      projectId: 'p1',
      totalBudget: 1000,
      totalActual: 1020,
      thresholdPct: 5,
      skipPersistence: true,
      disableNotifications: true
    })

    assert.equal(result.triggered, false)
  })

  it('triggers alerts when variance exceeds threshold', async () => {
    const result = await triggerVarianceAlert({
      projectId: 'p2',
      projectName: 'Alpha',
      totalBudget: 1000,
      totalActual: 1200,
      thresholdPct: 5,
      skipPersistence: true,
      disableNotifications: true
    })

    assert.equal(result.triggered, true)
    assert.equal(Math.round(result.variancePct), 20)
  })
})
