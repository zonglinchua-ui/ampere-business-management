import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { getProjectForecast } from '@/lib/budget/forecast'
import { applyScenarioSnapshot, listScenarios, saveScenario } from '@/lib/budget/scenarios'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined
    const scenarios = await listScenarios(projectId)

    return NextResponse.json(
      createSuccessResponse(scenarios, {
        message: `${scenarios.length} scenario(s) found`
      })
    )
  } catch (error) {
    console.error('[Budget Scenarios] Failed to load scenarios', error)
    return NextResponse.json(createErrorResponse('Failed to load scenarios'), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 })
    }

    const body = await request.json()
    const { name, projectId, adjustments } = body

    if (!name) {
      return NextResponse.json(createErrorResponse('Scenario name is required'), { status: 400 })
    }

    const baseline = projectId ? await getProjectForecast(projectId) : undefined
    const scenario = await saveScenario({ name, projectId, adjustments, baseline })
    const projection = baseline ? applyScenarioSnapshot(baseline, adjustments) : undefined

    return NextResponse.json(
      createSuccessResponse({ scenario, projection }, { message: 'Scenario saved' }),
      { status: 201 }
    )
  } catch (error) {
    console.error('[Budget Scenarios] Failed to save scenario', error)
    return NextResponse.json(createErrorResponse('Failed to save scenario'), { status: 500 })
  }
}
