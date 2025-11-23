'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check, MousePointer, PencilLine, Slash, Square, Target } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { DetectedElementResult } from '@/lib/takeoff/detection'
import { centroid, distanceBetweenPoints, distanceToSegment } from './geometry'
import { snapToGeometry } from './snap-utils'
import { TakeoffToolProvider, useTakeoffTools } from './tool-context'
import type { DetectionGeometry, Measurement, Point, TakeoffTool } from './types'

function transformDetections(detections: DetectedElementResult[]): DetectionGeometry[] {
  return detections.map((detected, index) => {
    if (detected.polygon) {
      return {
        id: detected.boundingBox?.x ? `${detected.type}-${detected.boundingBox.x}-${index}` : `${detected.type}-${index}`,
        type: 'polygon',
        points: detected.polygon.map(([x, y]) => ({ x, y })),
        label: detected.type,
        status: 'pending',
        confidence: detected.confidence,
      }
    }

    if (detected.boundingBox) {
      const { x, y, width, height } = detected.boundingBox
      return {
        id: `${detected.type}-${index}`,
        type: 'line',
        points: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
        label: detected.type,
        status: 'pending',
        confidence: detected.confidence,
      }
    }

    const centerX = detected.boundingBox ? detected.boundingBox.x + detected.boundingBox.width / 2 : 0
    const centerY = detected.boundingBox ? detected.boundingBox.y + detected.boundingBox.height / 2 : 0
    return {
      id: `${detected.type}-${index}`,
      type: 'point',
      points: [{ x: centerX, y: centerY }],
      status: 'pending',
      confidence: detected.confidence,
      label: detected.type,
    }
  })
}

function measurementDistance(measurement: Measurement, point: Point) {
  if (measurement.type === 'count') {
    return distanceBetweenPoints(measurement.points[0], point)
  }

  const pairs: Array<[Point, Point]> = []
  for (let i = 0; i < measurement.points.length - 1; i += 1) {
    pairs.push([measurement.points[i], measurement.points[i + 1]])
  }

  if (measurement.type === 'area' && measurement.points.length > 2) {
    pairs.push([measurement.points[measurement.points.length - 1], measurement.points[0]])
  }

  return pairs.reduce((min, [start, end]) => {
    const { distance } = distanceToSegment(point, start, end)
    return Math.min(min, distance)
  }, Number.POSITIVE_INFINITY)
}

function DetectionActionBar({
  detection,
  onApprove,
  onReject,
}: {
  detection?: DetectionGeometry
  onApprove: () => void
  onReject: () => void
}) {
  if (!detection) return null

  const label = detection.label ?? 'Detected element'

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-white/90 px-3 py-1 text-xs shadow">
      <span className="font-semibold text-slate-900">{label}</span>
      {detection.confidence ? <span className="text-slate-500">{Math.round(detection.confidence * 100)}%</span> : null}
      <button
        type="button"
        className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-emerald-700 hover:bg-emerald-200"
        onClick={onApprove}
      >
        <Check className="h-3 w-3" /> Approve
      </button>
      <button
        type="button"
        className="flex items-center gap-1 rounded bg-rose-100 px-2 py-1 text-rose-700 hover:bg-rose-200"
        onClick={onReject}
      >
        <Slash className="h-3 w-3" /> Reject
      </button>
    </div>
  )
}

function ToolSwitch({ current, onChange }: { current: TakeoffTool; onChange: (tool: TakeoffTool) => void }) {
  const options: Array<{ tool: TakeoffTool; icon: React.ReactNode; label: string }> = [
    { tool: 'select', label: 'Select', icon: <MousePointer className="h-4 w-4" /> },
    { tool: 'linear', label: 'Polyline', icon: <PencilLine className="h-4 w-4" /> },
    { tool: 'area', label: 'Polygon', icon: <Square className="h-4 w-4" /> },
    { tool: 'count', label: 'Count', icon: <Target className="h-4 w-4" /> },
  ]

  return (
    <div className="pointer-events-auto flex rounded-md bg-white/90 p-1 shadow">
      {options.map(({ tool, icon, label }) => (
        <button
          key={tool}
          type="button"
          onClick={() => onChange(tool)}
          className={clsx(
            'flex items-center gap-1 rounded px-3 py-1 text-xs font-medium text-slate-700 transition',
            current === tool ? 'bg-slate-900 text-white' : 'hover:bg-slate-100',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  )
}

function PlanMeasurementCanvasInner({ detections: incomingDetections }: { detections: DetectedElementResult[] }) {
  const { tool, setTool, startPointer, movePointer, endPointer, draftMeasurement, setDraftMeasurement, activeMeasurementId, setActiveMeasurementId } =
    useTakeoffTools()
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [detections, setDetections] = useState<DetectionGeometry[]>(() => transformDetections(incomingDetections))
  const [snapPoint, setSnapPoint] = useState<Point | null>(null)
  const [selectedDetectionId, setSelectedDetectionId] = useState<string>()
  const [dragging, setDragging] = useState<{ type: 'detection' | 'measurement'; id: string; vertex: number } | null>(null)

  useEffect(() => {
    setDetections(transformDetections(incomingDetections))
  }, [incomingDetections])

  const selectedDetection = useMemo(
    () => detections.find((det) => det.id === selectedDetectionId),
    [detections, selectedDetectionId],
  )

  const commitMeasurement = (measurement: Measurement) => {
    setMeasurements((prev) => [...prev.filter((item) => item.id !== measurement.id), measurement])
    setDraftMeasurement(null)
    setActiveMeasurementId(measurement.id)
  }

  const svgPointFromEvent = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    return { x, y }
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = svgPointFromEvent(event)
    const snapped = snapToGeometry(point, detections)
    const finalPoint = snapped.snapped ? snapped.point : point
    setSnapPoint(snapped.snapped ? snapped.point : null)
    startPointer(finalPoint)

    if (dragging) return

    if (tool === 'select') {
      const closestMeasurement = measurements
        .map((measurement) => ({ measurement, distance: measurementDistance(measurement, finalPoint) }))
        .sort((a, b) => a.distance - b.distance)[0]

      const closestDetection = detections
        .map((det) => {
          const measurementCompatible: Measurement = {
            id: det.id,
            type: det.type === 'point' ? 'count' : det.type === 'line' ? 'linear' : 'area',
            points: det.points,
          }

          return { det, distance: measurementDistance(measurementCompatible, finalPoint) }
        })
        .sort((a, b) => a.distance - b.distance)[0]

      if (closestMeasurement && closestMeasurement.distance < 14) {
        setActiveMeasurementId(closestMeasurement.measurement.id)
        setSelectedDetectionId(undefined)

        const vertexIndex = closestMeasurement.measurement.points.findIndex((pt) => distanceBetweenPoints(pt, finalPoint) < 10)
        if (vertexIndex >= 0) {
          setDragging({ type: 'measurement', id: closestMeasurement.measurement.id, vertex: vertexIndex })
        }
        return
      }

      if (closestDetection && closestDetection.distance < 14) {
        setSelectedDetectionId(closestDetection.det.id)
        setActiveMeasurementId(undefined)
        const vertexIndex = closestDetection.det.points.findIndex((pt) => distanceBetweenPoints(pt, finalPoint) < 10)
        if (vertexIndex >= 0) {
          setDragging({ type: 'detection', id: closestDetection.det.id, vertex: vertexIndex })
        }
        return
      }

      setActiveMeasurementId(undefined)
      setSelectedDetectionId(undefined)
      return
    }

    if (tool === 'count') {
      const measurement = { id: uuid(), type: 'count', points: [finalPoint], status: 'pending' } satisfies Measurement
      commitMeasurement(measurement)
      return
    }

    if (tool === 'linear' || tool === 'area') {
      if (!draftMeasurement || draftMeasurement.type !== tool) {
        setDraftMeasurement({ id: uuid(), type: tool, points: [finalPoint], status: 'pending' })
        return
      }

      setDraftMeasurement({ ...draftMeasurement, points: [...draftMeasurement.points, finalPoint] })
    }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = svgPointFromEvent(event)
    const snapped = snapToGeometry(point, detections)
    const finalPoint = snapped.snapped ? snapped.point : point
    setSnapPoint(snapped.snapped ? snapped.point : null)
    movePointer(finalPoint)

    if (dragging) {
      if (dragging.type === 'detection') {
        setDetections((prev) =>
          prev.map((det) => {
            if (det.id !== dragging.id) return det
            const nextPoints = det.points.map((pt, idx) => (idx === dragging.vertex ? finalPoint : pt))
            return { ...det, points: nextPoints }
          }),
        )
      } else {
        setMeasurements((prev) =>
          prev.map((measurement) => {
            if (measurement.id !== dragging.id) return measurement
            const points = measurement.points.map((pt, idx) => (idx === dragging.vertex ? finalPoint : pt))
            const updated = { ...measurement, points }
            return updated
          }),
        )
      }
    }

    if (draftMeasurement && (tool === 'linear' || tool === 'area')) {
      const basePoints = draftMeasurement.points.slice(0, -1)
      setDraftMeasurement({ ...draftMeasurement, points: [...basePoints, finalPoint] })
    }
  }

  const handlePointerUp = () => {
    endPointer()
    setDragging(null)
  }

  const handleDoubleClick = () => {
    if (!draftMeasurement) return

    const minPoints = draftMeasurement.type === 'linear' ? 2 : 3
    if (draftMeasurement.points.length >= minPoints) {
      commitMeasurement(draftMeasurement)
    }
  }

  const approveDetection = () => {
    if (!selectedDetection) return
    setDetections((prev) => prev.map((det) => (det.id === selectedDetection.id ? { ...det, status: 'approved' } : det)))
  }

  const rejectDetection = () => {
    if (!selectedDetection) return
    setDetections((prev) => prev.map((det) => (det.id === selectedDetection.id ? { ...det, status: 'rejected' } : det)))
  }

  return (
    <div className="relative flex h-full w-full flex-col gap-2">
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <ToolSwitch current={tool} onChange={setTool} />
        <DetectionActionBar detection={selectedDetection} onApprove={approveDetection} onReject={rejectDetection} />
      </div>
      <svg
        className="h-[640px] w-full touch-none bg-slate-50"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#0f172a" />
          </marker>
        </defs>

        {detections.map((det) => {
          if (det.type === 'polygon') {
            return (
              <polygon
                key={det.id}
                points={det.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                fill={det.status === 'approved' ? 'rgba(16,185,129,0.2)' : det.status === 'rejected' ? 'rgba(248,113,113,0.15)' : 'rgba(59,130,246,0.08)'}
                stroke={det.status === 'approved' ? '#10b981' : det.status === 'rejected' ? '#ef4444' : '#3b82f6'}
                strokeWidth={selectedDetectionId === det.id ? 3 : 2}
                className="transition"
              />
            )
          }

          if (det.type === 'line') {
            return (
              <polyline
                key={det.id}
                points={det.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                fill="none"
                stroke={det.status === 'approved' ? '#10b981' : det.status === 'rejected' ? '#ef4444' : '#3b82f6'}
                strokeWidth={selectedDetectionId === det.id ? 3 : 2}
                markerEnd="url(#arrowhead)"
              />
            )
          }

          return (
            <circle
              key={det.id}
              cx={det.points[0].x}
              cy={det.points[0].y}
              r={6}
              fill={det.status === 'approved' ? '#10b981' : det.status === 'rejected' ? '#ef4444' : '#3b82f6'}
            />
          )
        })}

        {measurements.map((measurement) => {
          const isActive = measurement.id === activeMeasurementId
          if (measurement.type === 'count') {
            const [center] = measurement.points
            return <circle key={measurement.id} cx={center.x} cy={center.y} r={6} fill={isActive ? '#0f172a' : '#6366f1'} />
          }

          const points = measurement.points
          const color = isActive ? '#0f172a' : '#6366f1'

          if (measurement.type === 'linear') {
            return (
              <polyline key={measurement.id} points={points.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={color} strokeWidth={3} />
            )
          }

          if (measurement.type === 'area') {
            return (
              <polygon
                key={measurement.id}
                points={points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                fill={isActive ? 'rgba(15,23,42,0.2)' : 'rgba(99,102,241,0.15)'}
                stroke={color}
                strokeWidth={3}
              />
            )
          }

          return null
        })}

        {draftMeasurement && draftMeasurement.points.length > 1 ? (
          draftMeasurement.type === 'area' ? (
            <polygon
              points={draftMeasurement.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="rgba(52,211,153,0.1)"
              stroke="#34d399"
              strokeDasharray="6 6"
              strokeWidth={2}
            />
          ) : (
            <polyline
              points={draftMeasurement.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke="#34d399"
              strokeDasharray="6 6"
              strokeWidth={2}
            />
          )
        ) : null}

        {snapPoint ? <circle cx={snapPoint.x} cy={snapPoint.y} r={7} fill="none" stroke="#f59e0b" strokeWidth={2} /> : null}

        {selectedDetection ? (
          <text
            x={centroid(selectedDetection.points).x}
            y={centroid(selectedDetection.points).y}
            className="select-none text-xs font-semibold fill-slate-800"
          >
            {selectedDetection.label ?? 'Detection'}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

export function PlanMeasurementCanvas(props: { detections: DetectedElementResult[] }) {
  return (
    <TakeoffToolProvider>
      <PlanMeasurementCanvasInner {...props} />
    </TakeoffToolProvider>
  )
}
