'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Measurement, Point, TakeoffTool } from './types'

export type PointerState = {
  isPointerDown: boolean
  lastPoint: Point | null
}

export type ToolState = {
  tool: TakeoffTool
  setTool: (tool: TakeoffTool) => void
  pointer: PointerState
  setPointer: (state: PointerState) => void
  activeMeasurementId?: string
  setActiveMeasurementId: (id?: string) => void
  draftMeasurement?: Measurement | null
  setDraftMeasurement: (measurement: Measurement | null) => void
}

const ToolContext = createContext<ToolState | undefined>(undefined)

export function TakeoffToolProvider({ children }: { children: React.ReactNode }) {
  const [tool, setTool] = useState<TakeoffTool>('select')
  const [pointer, setPointer] = useState<PointerState>({ isPointerDown: false, lastPoint: null })
  const [activeMeasurementId, setActiveMeasurementId] = useState<string | undefined>()
  const [draftMeasurement, setDraftMeasurement] = useState<Measurement | null>(null)

  const value = useMemo(
    () => ({
      tool,
      setTool,
      pointer,
      setPointer,
      activeMeasurementId,
      setActiveMeasurementId,
      draftMeasurement,
      setDraftMeasurement,
    }),
    [tool, pointer, activeMeasurementId, draftMeasurement],
  )

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>
}

export function useTakeoffTools() {
  const ctx = useContext(ToolContext)

  if (!ctx) {
    throw new Error('useTakeoffTools must be used within TakeoffToolProvider')
  }

  const startPointer = useCallback(
    (point: Point) => {
      ctx.setPointer({ isPointerDown: true, lastPoint: point })
    },
    [ctx],
  )

  const movePointer = useCallback(
    (point: Point) => {
      ctx.setPointer((prev) => ({ ...prev, lastPoint: point }))
    },
    [ctx],
  )

  const endPointer = useCallback(() => {
    ctx.setPointer({ isPointerDown: false, lastPoint: null })
  }, [ctx])

  return {
    ...ctx,
    startPointer,
    movePointer,
    endPointer,
  }
}
