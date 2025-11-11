
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, FileText, Link2, Upload, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface FinanceSummaryCard {
  title: string
  value: string | number
  description: string
  trend?: number
  trendDirection?: 'up' | 'down' | 'neutral'
  icon: 'payment' | 'invoice' | 'project' | 'vendor'
}

interface FinanceSummaryCardsProps {
  cards: FinanceSummaryCard[]
}

const iconMap = {
  payment: DollarSign,
  invoice: FileText,
  project: Link2,
  vendor: Upload
}

export function FinanceSummaryCards({ cards }: FinanceSummaryCardsProps) {
  // Defensive check: ensure cards is always an array
  const safeCards = Array.isArray(cards) ? cards : []
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {safeCards.map((card, index) => {
        const Icon = iconMap[card.icon]
        
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </CardTitle>
              <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {typeof card.value === 'number' ? formatCurrency(card.value, 'SGD') : card.value}
              </div>
              <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                {card.trend !== undefined && card.trendDirection && card.trendDirection !== 'neutral' && (
                  <span className={`flex items-center mr-2 ${
                    card.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.trendDirection === 'up' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(card.trend)}%
                  </span>
                )}
                {card.description}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
