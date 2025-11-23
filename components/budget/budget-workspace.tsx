'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar } from 'recharts'
import { BudgetForecast } from '@/lib/budget/forecast'
import {
  ScenarioAdjustment,
  BudgetScenario
} from '@/lib/budget/scenarios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface BudgetWorkspaceProps {
  forecasts: BudgetForecast[]
  mode: 'forecast' | 'scenarios'
}

const currency = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function BudgetWorkspace({ forecasts, mode }: BudgetWorkspaceProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(forecasts[0]?.projectId)
  const [adjustments, setAdjustments] = useState<ScenarioAdjustment>({
    percentageChange: 0,
    hiringHeadcount: 0,
    purchaseOrderImpact: 0,
    hiringCostPerHead: 8000
  })
  const [scenarioName, setScenarioName] = useState('New scenario')
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([])
  const [saving, setSaving] = useState(false)

  const selectedForecast = useMemo(
    () => forecasts.find((forecast) => forecast.projectId === selectedProjectId) ?? forecasts[0],
    [forecasts, selectedProjectId]
  )

  useEffect(() => {
    if (mode !== 'scenarios') return

    const loadScenarios = async () => {
      const projectParam = selectedProjectId ? `?projectId=${selectedProjectId}` : ''
      const response = await fetch(`/api/budget/scenarios${projectParam}`)
      if (response.ok) {
        const payload = await response.json()
        setScenarios(payload.data || [])
      }
    }

    loadScenarios()
  }, [mode, selectedProjectId])

  const projected = useMemo(() => {
    if (!selectedForecast) return undefined
    const pct = (adjustments.percentageChange ?? 0) / 100
    const hiring = (adjustments.hiringHeadcount ?? 0) * (adjustments.hiringCostPerHead ?? 8000)
    const poImpact = adjustments.purchaseOrderImpact ?? 0
    const totalBudget = selectedForecast.totalBudget * (1 + pct) + poImpact
    const totalActual = selectedForecast.totalActual + hiring
    const remaining = totalBudget - totalActual

    return {
      totalBudget,
      totalActual,
      remaining
    }
  }, [adjustments, selectedForecast])

  const handleScenarioSave = async () => {
    if (!scenarioName) return
    setSaving(true)
    try {
      const response = await fetch('/api/budget/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scenarioName,
          projectId: selectedForecast?.projectId,
          adjustments
        })
      })

      if (response.ok) {
        const payload = await response.json()
        setScenarios((prev) => [...prev, payload.data.scenario])
      }
    } finally {
      setSaving(false)
    }
  }

  if (!selectedForecast) {
    return <div className="p-4 text-sm text-muted-foreground">No projects with budgets found.</div>
  }

  const monthlyData = selectedForecast.monthlyActuals.map((item) => ({
    month: item.month,
    Actuals: item.actual
  }))

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{selectedForecast.projectName}</CardTitle>
          <CardDescription>
            Budget remaining {currency(selectedForecast.remainingBudget)} | Burn rate {currency(selectedForecast.burnRate.burnRatePerDay)} per day
          </CardDescription>
        </div>
        <div className="w-full max-w-xs">
          <Label className="mb-1 block text-xs uppercase tracking-wide">Project</Label>
          <Select value={selectedForecast.projectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {forecasts.map((forecast) => (
                <SelectItem key={forecast.projectId} value={forecast.projectId}>
                  {forecast.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === 'forecast' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actuals</CardTitle>
              <CardDescription>Track how spending is trending over time.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {monthlyData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No actuals yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => currency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="Actuals" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category burn</CardTitle>
              <CardDescription>Budget performance by category.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedForecast.categories} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                  <Bar dataKey="budgeted" fill="#16A34A" name="Budgeted" />
                  <Bar dataKey="actual" fill="#E11D48" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === 'scenarios' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>What-if adjustments</CardTitle>
              <CardDescription>Tweak assumptions to see the burn-rate impact.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Scenario name</Label>
                <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Hiring push in Q3" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>% budget change</Label>
                  <Input
                    type="number"
                    value={adjustments.percentageChange ?? 0}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, percentageChange: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>PO impact</Label>
                  <Input
                    type="number"
                    value={adjustments.purchaseOrderImpact ?? 0}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, purchaseOrderImpact: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>New hires</Label>
                  <Input
                    type="number"
                    value={adjustments.hiringHeadcount ?? 0}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, hiringHeadcount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Cost per hire</Label>
                  <Input
                    type="number"
                    value={adjustments.hiringCostPerHead ?? 8000}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, hiringCostPerHead: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Adjusted budget</p>
                  <p className="font-semibold">{currency(projected?.totalBudget ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projected spend</p>
                  <p className="font-semibold">{currency(projected?.totalActual ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-semibold">{currency(projected?.remaining ?? 0)}</p>
                </div>
              </div>

              <Button onClick={handleScenarioSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save scenario'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved scenarios</CardTitle>
              <CardDescription>Snapshots of the adjustments you have explored.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scenarios.length === 0 && <p className="text-sm text-muted-foreground">No scenarios saved yet.</p>}
              {scenarios.map((scenario) => (
                <div key={scenario.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{scenario.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(scenario.updatedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {scenario.adjustments.percentageChange ?? 0}% | hires {scenario.adjustments.hiringHeadcount ?? 0}
                    </div>
                  </div>
                  {scenario.snapshot && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Budget</p>
                        <p className="font-semibold">{currency(scenario.snapshot.totalBudget)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Projected</p>
                        <p className="font-semibold">{currency(scenario.snapshot.totalActual)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === 'scenarios' && selectedForecast && (
        <Card>
          <CardHeader>
            <CardTitle>Compare baseline vs scenario</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    label: 'Baseline',
                    Budget: selectedForecast.totalBudget,
                    Actuals: selectedForecast.totalActual
                  },
                  {
                    label: 'Scenario',
                    Budget: projected?.totalBudget ?? 0,
                    Actuals: projected?.totalActual ?? 0
                  }
                ]}
                margin={{ left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => currency(value)} />
                <Legend />
                <Bar dataKey="Budget" fill="#16A34A" />
                <Bar dataKey="Actuals" fill="#E11D48" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
