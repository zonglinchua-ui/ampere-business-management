import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPortfolioForecast } from '@/lib/budget/forecast'
import BudgetWorkspace from '@/components/budget/budget-workspace'

export const dynamic = 'force-dynamic'

export default async function BudgetHomePage() {
  const forecasts = await getPortfolioForecast()

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Budget Planning</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="forecast" className="w-full">
            <TabsList>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            </TabsList>
            <TabsContent value="forecast">
              <BudgetWorkspace mode="forecast" forecasts={forecasts} />
            </TabsContent>
            <TabsContent value="scenarios">
              <BudgetWorkspace mode="scenarios" forecasts={forecasts} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
