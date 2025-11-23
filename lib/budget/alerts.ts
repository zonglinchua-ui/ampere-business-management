import { prisma } from '../db'
import { notifySuperAdmins } from '../push-notifications'
import { AlertSeverity, BudgetAlertType } from '@prisma/client'

export interface VarianceCheck {
  projectId: string
  projectName?: string
  totalBudget: number
  totalActual: number
  thresholdPct?: number
  slackWebhookUrl?: string
  emailWebhookUrl?: string
  skipPersistence?: boolean
  disableNotifications?: boolean
}

export interface VarianceResult {
  triggered: boolean
  variancePct: number
  overBudgetAmount: number
}

export function calculateVariance(totalBudget: number, totalActual: number) {
  if (totalBudget === 0) {
    return { variancePct: 100, overBudgetAmount: totalActual }
  }
  const overBudgetAmount = Math.max(0, totalActual - totalBudget)
  const variancePct = overBudgetAmount > 0 ? (overBudgetAmount / totalBudget) * 100 : 0
  return { variancePct, overBudgetAmount }
}

async function sendSlackAlert(webhookUrl: string, message: string) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    })
  } catch (error) {
    console.error('[Budget Alerts] Failed to send Slack alert', error)
  }
}

async function sendEmailWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    console.error('[Budget Alerts] Failed to call email webhook', error)
  }
}

export async function triggerVarianceAlert(params: VarianceCheck): Promise<VarianceResult> {
  const { variancePct, overBudgetAmount } = calculateVariance(params.totalBudget, params.totalActual)
  const threshold = params.thresholdPct ?? 5

  if (variancePct < threshold) {
    return { triggered: false, variancePct, overBudgetAmount }
  }

  const message = `Budget variance detected for ${params.projectName ?? params.projectId}: ${variancePct.toFixed(1)}% over plan.`

  if (!params.skipPersistence) {
    await prisma.budgetAlert.create({
      data: {
        projectId: params.projectId,
        alertType: BudgetAlertType.BUDGET_EXCEEDED,
        severity: variancePct > 15 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        title: 'Budget variance detected',
        message,
        threshold: threshold,
        currentValue: params.totalActual,
        limitValue: params.totalBudget
      }
    })
  }

  if (!params.disableNotifications && (params.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL)) {
    await sendSlackAlert(params.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL!, message)
  }

  if (!params.disableNotifications && (params.emailWebhookUrl || process.env.BUDGET_ALERT_EMAIL_WEBHOOK)) {
    await sendEmailWebhook(params.emailWebhookUrl || process.env.BUDGET_ALERT_EMAIL_WEBHOOK!, {
      subject: 'Budget variance detected',
      message,
      projectId: params.projectId,
      variancePct,
      overBudgetAmount
    })
  }

  if (!params.disableNotifications) {
    await notifySuperAdmins({
      title: 'Budget variance detected',
      message,
      severity: variancePct > 15 ? 'critical' : 'warning'
    })
  }

  return { triggered: true, variancePct, overBudgetAmount }
}
