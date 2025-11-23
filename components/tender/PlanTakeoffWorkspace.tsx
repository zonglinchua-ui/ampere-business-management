import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { FileImage, Filter, Layers, Ruler } from "lucide-react"

export type PlanSheetSummary = {
  id: string
  name: string
  fileUrl?: string
  pageCount?: number | null
  dpi?: number | null
  scale?: number | null
  units?: string | null
}

type DetectionOverlay = {
  id: string
  sheetId: string
  label: string
  type: string
  discipline: string
  polygon: Array<[number, number]>
  confidence: number
}

type MeasurementOverlay = {
  id: string
  sheetId: string
  label: string
  type: string
  discipline: string
  start: [number, number]
  end: [number, number]
  length: number
  units: string
}

type CalibrationState = {
  pixelDistance: number
  knownDistance: number
  units: string
}

const DISCIPLINE_COLORS: Record<string, string> = {
  architectural: "#f97316",
  structural: "#2563eb",
  mechanical: "#22c55e",
  electrical: "#a855f7",
  plumbing: "#06b6d4",
  safety: "#ef4444",
}

const TYPE_COLORS: Record<string, string> = {
  wall: "#0ea5e9",
  opening: "#a855f7",
  dimension: "#f97316",
  annotation: "#22c55e",
  slab: "#2563eb",
  beam: "#7c3aed",
  duct: "#06b6d4",
  conduit: "#f59e0b",
}

function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return (h >>> 0) / 0xffffffff
  }
}

function createPolygon(seed: string, width = 1000, height = 750): Array<[number, number]> {
  const random = seededRandom(seed)
  const w = 120 + random() * 180
  const h = 90 + random() * 140
  const x = random() * (width - w - 80) + 40
  const y = random() * (height - h - 80) + 40

  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

function getColorForOverlay(discipline: string, type: string) {
  return DISCIPLINE_COLORS[discipline] || TYPE_COLORS[type] || "#0f172a"
}

export function PlanTakeoffWorkspace({ planSheets }: { planSheets: PlanSheetSummary[] }) {
  const [activeSheetId, setActiveSheetId] = useState(planSheets[0]?.id || "")
  const [calibrations, setCalibrations] = useState<Record<string, CalibrationState>>({})
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (planSheets.length && !activeSheetId) {
      setActiveSheetId(planSheets[0].id)
    }
  }, [activeSheetId, planSheets])

  const detections: DetectionOverlay[] = useMemo(() => {
    if (!planSheets.length) return []

    const disciplines = Object.keys(DISCIPLINE_COLORS)
    const baseTypes = Object.keys(TYPE_COLORS)

    return planSheets.flatMap((sheet, sheetIndex) => {
      const random = seededRandom(`${sheet.id}-${sheetIndex}`)
      return Array.from({ length: 6 }).map((_, idx) => {
        const discipline = disciplines[(idx + sheetIndex) % disciplines.length]
        const type = baseTypes[(idx + sheetIndex * 2) % baseTypes.length]
        return {
          id: `${sheet.id}-det-${idx}`,
          sheetId: sheet.id,
          label: `${discipline} ${type}`,
          type,
          discipline,
          polygon: createPolygon(`${sheet.id}-${idx}-${random()}`),
          confidence: Number((0.68 + random() * 0.25).toFixed(2)),
        }
      })
    })
  }, [planSheets])

  const measurements: MeasurementOverlay[] = useMemo(() => {
    if (!planSheets.length) return []

    return planSheets.flatMap((sheet, sheetIndex) => {
      const pairs: Array<[number, number]> = [
        [120 + sheetIndex * 20, 140 + sheetIndex * 12],
        [480 + sheetIndex * 10, 140 + sheetIndex * 10],
        [220 + sheetIndex * 15, 360 + sheetIndex * 8],
      ]

      return [
        {
          id: `${sheet.id}-m1`,
          sheetId: sheet.id,
          label: "Gridline span",
          type: "dimension",
          discipline: "structural",
          start: [pairs[0][0], pairs[0][1]],
          end: [pairs[1][0], pairs[1][1]],
          length: 18 + sheetIndex * 2,
          units: "m",
        },
        {
          id: `${sheet.id}-m2`,
          sheetId: sheet.id,
          label: "Duct run",
          type: "dimension",
          discipline: "mechanical",
          start: [pairs[1][0], pairs[1][1] + 120],
          end: [pairs[2][0], pairs[2][1] + 120],
          length: 12 + sheetIndex,
          units: "m",
        },
      ]
    })
  }, [planSheets])

  useEffect(() => {
    const sheetDetections = detections.filter((d) => d.sheetId === (activeSheetId || planSheets[0]?.id))
    if (sheetDetections.length) {
      setSelectedDisciplines(new Set(sheetDetections.map((d) => d.discipline)))
      setSelectedTypes(new Set(sheetDetections.map((d) => d.type)))
    }
  }, [activeSheetId, detections, planSheets])

  const activeSheet = planSheets.find((sheet) => sheet.id === activeSheetId)
  const calibration = calibrations[activeSheetId] || {
    pixelDistance: 900,
    knownDistance: activeSheet?.scale ? Number(activeSheet.scale) : 10,
    units: activeSheet?.units || "m",
  }

  const computedScale = calibration.pixelDistance > 0
    ? Number((calibration.knownDistance / calibration.pixelDistance).toFixed(4))
    : null

  const activeDetections = detections.filter(
    (detection) =>
      detection.sheetId === activeSheetId &&
      (selectedDisciplines.size === 0 || selectedDisciplines.has(detection.discipline)) &&
      (selectedTypes.size === 0 || selectedTypes.has(detection.type)),
  )

  const activeMeasurements = measurements.filter(
    (measurement) =>
      measurement.sheetId === activeSheetId &&
      (selectedDisciplines.size === 0 || selectedDisciplines.has(measurement.discipline)) &&
      (selectedTypes.size === 0 || selectedTypes.has(measurement.type)),
  )

  const availableTypes = Array.from(
    new Set(detections.filter((d) => d.sheetId === activeSheetId).map((d) => d.type)),
  )

  const availableDisciplines = Array.from(
    new Set(detections.filter((d) => d.sheetId === activeSheetId).map((d) => d.discipline)),
  )

  const handleCalibrationSave = () => {
    setCalibrations((prev) => ({
      ...prev,
      [activeSheetId]: calibration,
    }))
  }

  const toggleDiscipline = (discipline: string, checked: boolean) => {
    setSelectedDisciplines((prev) => {
      const updated = new Set(prev)
      if (checked) {
        updated.add(discipline)
      } else {
        updated.delete(discipline)
      }
      return updated
    })
  }

  const toggleType = (type: string, checked: boolean) => {
    setSelectedTypes((prev) => {
      const updated = new Set(prev)
      if (checked) {
        updated.add(type)
      } else {
        updated.delete(type)
      }
      return updated
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1 h-full">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileImage className="h-4 w-4" /> Sheets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse sheets, set an active canvas, and update calibration when you have a known dimension.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-72">
              <div className="space-y-3">
                {planSheets.length ? (
                  planSheets.map((sheet) => {
                    const sheetCalibration = calibrations[sheet.id]
                    return (
                      <button
                        key={sheet.id}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition hover:border-red-500",
                          activeSheetId === sheet.id ? "border-red-500 bg-red-50/50" : "border-muted",
                        )}
                        onClick={() => setActiveSheetId(sheet.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold leading-tight">{sheet.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sheet.pageCount ? `${sheet.pageCount} pages · ` : ""}
                              {sheet.dpi ? `${sheet.dpi} dpi` : "Scale TBD"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[11px]">
                            {sheetCalibration?.knownDistance || sheet.scale ? "Calibrated" : "Needs scale"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-muted px-2 py-0.5">{sheet.units || "units"}</span>
                          {sheet.scale && <span>1:{sheet.scale}</span>}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Upload plan sheets to start calibrating.</p>
                )}
              </div>
            </ScrollArea>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-semibold leading-none">Scale calibration</p>
                  <p className="text-xs text-muted-foreground">Use a known span to lock scale.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pixel-distance">Measured pixels</Label>
                  <Input
                    id="pixel-distance"
                    type="number"
                    inputMode="numeric"
                    value={calibration.pixelDistance}
                    onChange={(event) =>
                      setCalibrations((prev) => ({
                        ...prev,
                        [activeSheetId]: {
                          ...calibration,
                          pixelDistance: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="real-distance">Known distance</Label>
                  <Input
                    id="real-distance"
                    type="number"
                    inputMode="decimal"
                    value={calibration.knownDistance}
                    onChange={(event) =>
                      setCalibrations((prev) => ({
                        ...prev,
                        [activeSheetId]: {
                          ...calibration,
                          knownDistance: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="units">Units</Label>
                  <Input
                    id="units"
                    value={calibration.units}
                    onChange={(event) =>
                      setCalibrations((prev) => ({
                        ...prev,
                        [activeSheetId]: {
                          ...calibration,
                          units: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col justify-end space-y-1 text-xs text-muted-foreground">
                  <p>Pixels: {calibration.pixelDistance || 0}</p>
                  <p>
                    1 px ≈ {computedScale ? `${computedScale} ${calibration.units}` : "–"}
                  </p>
                </div>
              </div>
              <Button onClick={handleCalibrationSave} variant="secondary" className="w-full">
                Save calibration
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              Active sheet
              <Badge variant="secondary">{activeSheet?.name || "None selected"}</Badge>
              {computedScale && (
                <Badge variant="outline">1 px ≈ {computedScale} {calibration.units}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filters sync with overlay</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3 overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
                  <div className="absolute inset-4 rounded-lg border border-dashed border-muted bg-white/70 dark:bg-slate-950/60">
                    <svg viewBox="0 0 1000 750" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                      {activeDetections.map((detection) => {
                        const color = getColorForOverlay(detection.discipline, detection.type)
                        const points = detection.polygon.map((point) => point.join(",")).join(" ")
                        return (
                          <g key={detection.id}>
                            <polygon
                              points={points}
                              fill={`${color}22`}
                              stroke={color}
                              strokeWidth={3}
                              strokeDasharray="6 4"
                            />
                            <text
                              x={detection.polygon[0][0] + 6}
                              y={detection.polygon[0][1] + 18}
                              fontSize={14}
                              fill="#0f172a"
                              opacity={0.9}
                            >
                              {detection.label}
                            </text>
                          </g>
                        )
                      })}

                      {activeMeasurements.map((measurement) => {
                        const color = getColorForOverlay(measurement.discipline, measurement.type)
                        return (
                          <g key={measurement.id}>
                            <line
                              x1={measurement.start[0]}
                              y1={measurement.start[1]}
                              x2={measurement.end[0]}
                              y2={measurement.end[1]}
                              stroke={color}
                              strokeWidth={4}
                              strokeLinecap="round"
                            />
                            <text
                              x={(measurement.start[0] + measurement.end[0]) / 2}
                              y={(measurement.start[1] + measurement.end[1]) / 2 - 8}
                              fontSize={13}
                              textAnchor="middle"
                              fill={color}
                              fontWeight={600}
                            >
                              {measurement.label}
                            </text>
                            <text
                              x={(measurement.start[0] + measurement.end[0]) / 2}
                              y={(measurement.start[1] + measurement.end[1]) / 2 + 10}
                              fontSize={12}
                              textAnchor="middle"
                              fill={color}
                            >
                              ≈ {measurement.length} {measurement.units}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filters & legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Disciplines</p>
                  <div className="space-y-2">
                    {availableDisciplines.map((discipline) => (
                      <label key={discipline} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedDisciplines.has(discipline)}
                          onCheckedChange={(checked) => toggleDiscipline(discipline, Boolean(checked))}
                        />
                        <span className="text-sm flex-1 capitalize">{discipline}</span>
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: `${getColorForOverlay(discipline, "")}33`, borderColor: getColorForOverlay(discipline, "") }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Element types</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTypes.map((type) => (
                      <Badge
                        key={type}
                        variant={selectedTypes.has(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: selectedTypes.has(type) ? `${getColorForOverlay("", type)}22` : undefined,
                          color: selectedTypes.has(type) ? getColorForOverlay("", type) : undefined,
                          borderColor: getColorForOverlay("", type),
                        }}
                        onClick={() => toggleType(type, !selectedTypes.has(type))}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Legend</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDisciplines.map((discipline) => (
                      <div key={discipline} className="flex items-center gap-2 rounded border p-2">
                        <span
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: `${getColorForOverlay(discipline, "")}66` }}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold capitalize">{discipline}</p>
                          <p className="text-xs text-muted-foreground">Overlay + measurements</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
