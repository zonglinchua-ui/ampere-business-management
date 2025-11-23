export type TakeoffTool = 'select' | 'linear' | 'area' | 'count'

export type Point = {
  x: number
  y: number
}

export type MeasurementType = 'linear' | 'area' | 'count'

export type Measurement = {
  id: string
  type: MeasurementType
  points: Point[]
  label?: string
  detectedElementId?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export type DetectionGeometryType = 'line' | 'polygon' | 'point'

export type DetectionGeometry = {
  id: string
  type: DetectionGeometryType
  label?: string
  points: Point[]
  confidence?: number
  status?: 'pending' | 'approved' | 'rejected'
}

export type SnapType = 'vertex' | 'edge' | 'point' | 'detection'

export type SnapResult = {
  snapped: boolean
  point: Point
  sourceId?: string
  type?: SnapType
}
