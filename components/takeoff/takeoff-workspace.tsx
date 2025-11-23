'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type TakeoffPlanSheet = {
  id: string
  name: string
  fileUrl?: string
  scale?: number | null
  units?: string | null
}

type TakeoffDiscipline = 'architecture' | 'structure' | 'mep' | 'annotation'
type TakeoffType = 'wall' | 'opening' | 'column' | 'duct' | 'dimension' | 'note'

type TakeoffElement = {
  id: string
  type: TakeoffType
  discipline: TakeoffDiscipline
  polygon: Array<[number, number]>
  confidence?: number
}

type MeasurementOverlay = {
  id: string
  discipline: TakeoffDiscipline
  type: TakeoffType
  start: [number, number]
  end: [number, number]
  value: number
  unit: string
}

const DISCIPLINE_COLORS: Record<TakeoffDiscipline, string> = {
  architecture: '#ec4899',
  structure: '#2563eb',
  mep: '#22c55e',
  annotation: '#f97316',
}

const TYPE_DISCIPLINE_MAP: Record<TakeoffType, TakeoffDiscipline> = {
  wall: 'architecture',
  opening: 'architecture',
  column: 'structure',
  duct: 'mep',
  dimension: 'annotation',
  note: 'annotation',
}

const VIEWBOX_WIDTH = 1200
const VIEWBOX_HEIGHT = 800

function generateMockGeometry(seed: number): Array<[number, number]> {
  const baseX = 80 + (seed % 7) * 35
  const baseY = 120 + (seed % 5) * 40
  const width = 120 + (seed % 3) * 45
  const height = 110 + (seed % 4) * 30

  return [
    [baseX, baseY],
    [baseX + width, baseY],
    [baseX + width, baseY + height],
    [baseX, baseY + height],
  ]
}

function generateMockData(plan: TakeoffPlanSheet, index: number) {
  const elements: TakeoffElement[] = [
    {
      id: `${plan.id}-wall`,
      type: 'wall',
      discipline: 'architecture',
      polygon: generateMockGeometry(index + 1),
      confidence: 0.88,
    },
    {
      id: `${plan.id}-opening`,
      type: 'opening',
      discipline: 'architecture',
      polygon: generateMockGeometry(index + 2).map(([x, y]) => [x + 160, y + 10]),
      confidence: 0.82,
    },
    {
      id: `${plan.id}-column`,
      type: 'column',
      discipline: 'structure',
      polygon: generateMockGeometry(index + 3).map(([x, y]) => [x + 80, y + 140]),
      confidence: 0.91,
    },
    {
      id: `${plan.id}-duct`,
      type: 'duct',
      discipline: 'mep',
      polygon: generateMockGeometry(index + 4).map(([x, y]) => [x + 260, y + 180]),
      confidence: 0.77,
    },
    {
      id: `${plan.id}-note`,
      type: 'note',
      discipline: 'annotation',
      polygon: generateMockGeometry(index + 5).map(([x, y]) => [x + 60, y + 240]),
      confidence: 0.69,
    },
  ]

  const measurements: MeasurementOverlay[] = [
    {
      id: `${plan.id}-dim-primary`,
      type: 'dimension',
      discipline: 'annotation',
      start: [220 + index * 30, 520],
      end: [560 + index * 40, 520],
      value: 3200,
      unit: 'mm',
    },
    {
      id: `${plan.id}-dim-secondary`,
      type: 'dimension',
      discipline: 'annotation',
      start: [260 + index * 35, 600],
      end: [420 + index * 25, 640],
      value: 1800,
      unit: 'mm',
    },
  ]

  return { elements, measurements }
}

function polygonPoints(points: Array<[number, number]>) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

export function TakeoffWorkspace({ planSheets }: { planSheets: TakeoffPlanSheet[] }) {
  const [activeSheetId, setActiveSheetId] = useState<string | undefined>(planSheets[0]?.id)
  const [calibration, setCalibration] = useState<Record<string, { measured: string; realWorld: string; units: string }>>({})
  const [disciplineFilters, setDisciplineFilters] = useState<Set<TakeoffDiscipline>>(new Set(['architecture', 'structure', 'mep', 'annotation']))
  const [typeFilters, setTypeFilters] = useState<Set<TakeoffType>>(new Set(['wall', 'opening', 'column', 'duct', 'dimension', 'note']))

  const activeSheet = planSheets.find((sheet) => sheet.id === activeSheetId) ?? planSheets[0]

  const planData = useMemo(() => {
    return planSheets.map((sheet, index) => ({
      sheet,
      ...generateMockData(sheet, index),
    }))
  }, [planSheets])

  const activeData = planData.find((entry) => entry.sheet.id === activeSheet?.id)

  const calibrationState = calibration[activeSheet?.id ?? ''] ?? {
    measured: '',
    realWorld: '',
    units: activeSheet?.units ?? 'mm',
  }

  const activeScaleFactor = useMemo(() => {
    const measured = Number(calibrationState.measured)
    const realWorld = Number(calibrationState.realWorld)

    if (!measured || !realWorld || Number.isNaN(measured) || Number.isNaN(realWorld)) {
      return null
    }

    return realWorld / measured
  }, [calibrationState.measured, calibrationState.realWorld])

  const toggleDiscipline = (discipline: TakeoffDiscipline) => {
    setDisciplineFilters((prev) => {
      const next = new Set(prev)
      if (next.has(discipline)) {
        next.delete(discipline)
      } else {
        next.add(discipline)
      }
      return next
    })
  }

  const toggleType = (type: TakeoffType) => {
    setTypeFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const filteredElements = (activeData?.elements ?? []).filter(
    (element) => disciplineFilters.has(element.discipline) && typeFilters.has(element.type),
  )

  const filteredMeasurements = (activeData?.measurements ?? []).filter(
    (measurement) => disciplineFilters.has(measurement.discipline) && typeFilters.has(measurement.type),
  )

  const legendItems = useMemo(() => {
    return Object.entries(DISCIPLINE_COLORS).map(([discipline, color]) => ({
      discipline: discipline as TakeoffDiscipline,
      color,
    }))
  }, [])

  const handleCalibrationChange = (field: 'measured' | 'realWorld' | 'units', value: string) => {
    if (!activeSheet?.id) return

    setCalibration((prev) => ({
      ...prev,
      [activeSheet.id]: {
        ...calibrationState,
        [field]: value,
      },
    }))
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sheets</span>
            <Badge variant="secondary">{planSheets.length} loaded</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-3">
              {planSheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => setActiveSheetId(sheet.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition hover:border-red-500/50',
                    activeSheet?.id === sheet.id ? 'border-red-500 shadow-sm ring-1 ring-red-200' : 'border-muted',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-md border bg-muted">
                      {sheet.fileUrl ? (
                        <Image
                          src={sheet.fileUrl}
                          alt={sheet.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          PDF
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium leading-tight">{sheet.name}</p>
                        {sheet.scale ? (
                          <Badge variant="outline">1:{sheet.scale}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Scale needed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{sheet.units || 'units not set'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">Scale calibration</p>
              <Badge variant={activeScaleFactor ? 'secondary' : 'outline'}>
                {activeScaleFactor ? `x${activeScaleFactor.toFixed(2)} applied` : 'Pending'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Input the known distance between two points on the active sheet to calibrate measurements.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Measured on plan"
                value={calibrationState.measured}
                onChange={(event) => handleCalibrationChange('measured', event.target.value)}
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Real world distance"
                value={calibrationState.realWorld}
                onChange={(event) => handleCalibrationChange('realWorld', event.target.value)}
              />
            </div>
            <Input
              placeholder="Units (e.g. mm)"
              value={calibrationState.units}
              onChange={(event) => handleCalibrationChange('units', event.target.value)}
            />
            {activeScaleFactor && (
              <p className="text-xs text-green-700">
                1 plan unit = {(activeScaleFactor).toFixed(3)} {calibrationState.units}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardHeader>
          <CardTitle>Detections & overlays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium">Element filters</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(DISCIPLINE_COLORS).map((discipline) => (
                  <Button
                    key={discipline}
                    size="sm"
                    variant={disciplineFilters.has(discipline as TakeoffDiscipline) ? 'secondary' : 'outline'}
                    onClick={() => toggleDiscipline(discipline as TakeoffDiscipline)}
                    className="capitalize"
                  >
                    {discipline}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Types</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(TYPE_DISCIPLINE_MAP).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={typeFilters.has(type as TakeoffType) ? 'secondary' : 'outline'}
                    onClick={() => toggleType(type as TakeoffType)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {legendItems.map((item) => (
              <div
                key={item.discipline}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="capitalize">{item.discipline}</span>
              </div>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-lg border bg-muted/40">
            <div className="relative h-[520px] w-full">
              {activeSheet?.fileUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeSheet.fileUrl}
                  alt={activeSheet.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Sheet preview unavailable. Using overlay-only mode.
                </div>
              )}

              <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className="pointer-events-none absolute inset-0 h-full w-full"
                role="presentation"
              >
                {filteredElements.map((element) => {
                  const color = DISCIPLINE_COLORS[element.discipline]
                  return (
                    <g key={element.id}>
                      <polygon
                        points={polygonPoints(element.polygon)}
                        fill={`${color}26`}
                        stroke={color}
                        strokeWidth={2}
                      />
                    </g>
                  )
                })}

                {filteredMeasurements.map((measurement) => {
                  const color = DISCIPLINE_COLORS[measurement.discipline]
                  return (
                    <g key={measurement.id}>
                      <line
                        x1={measurement.start[0]}
                        y1={measurement.start[1]}
                        x2={measurement.end[0]}
                        y2={measurement.end[1]}
                        stroke={color}
                        strokeWidth={3}
                        strokeDasharray="8 4"
                      />
                      <text
                        x={(measurement.start[0] + measurement.end[0]) / 2}
                        y={(measurement.start[1] + measurement.end[1]) / 2 - 8}
                        fill={color}
                        fontSize={14}
                        textAnchor="middle"
                        className="font-semibold"
                      >
                        {measurement.value} {measurement.unit}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TakeoffWorkspace
