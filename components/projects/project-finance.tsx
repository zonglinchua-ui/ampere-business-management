'use client'

import { SimplifiedFinanceDashboard } from './finance/simplified-finance-dashboard'

interface ProjectFinanceProps {
  projectId: string
  project: {
    id: string
    name: string
    projectNumber: string
    contractValue?: number | null
    estimatedBudget?: number | null
    customerId?: string
  }
}

export function ProjectFinance({ projectId, project }: ProjectFinanceProps) {
  return <SimplifiedFinanceDashboard projectId={projectId} project={project} />
}
