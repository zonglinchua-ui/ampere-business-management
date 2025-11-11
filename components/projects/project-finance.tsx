'use client'

import { UnifiedFinanceDashboard } from './finance/unified-finance-dashboard'

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
  return <UnifiedFinanceDashboard projectId={projectId} project={project} />
}
