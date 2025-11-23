import { distanceToSegment, distanceBetweenPoints } from './geometry'
import type { DetectionGeometry, Point, SnapResult } from './types'

const POINT_THRESHOLD = 12
const EDGE_THRESHOLD = 10

export function snapToGeometry(point: Point, detections: DetectionGeometry[]): SnapResult {
  let closest: SnapResult = { snapped: false, point }

  detections.forEach((geometry) => {
    if (geometry.type === 'point') {
      geometry.points.forEach((candidate) => {
        const distance = distanceBetweenPoints(point, candidate)
        if (distance < POINT_THRESHOLD && (!closest.snapped || distance < distanceBetweenPoints(point, closest.point))) {
          closest = {
            snapped: true,
            point: candidate,
            sourceId: geometry.id,
            type: 'point',
          }
        }
      })
    }

    if (geometry.type === 'line' || geometry.type === 'polygon') {
      geometry.points.forEach((candidate) => {
        const distance = distanceBetweenPoints(point, candidate)
        if (distance < POINT_THRESHOLD && (!closest.snapped || distance < distanceBetweenPoints(point, closest.point))) {
          closest = {
            snapped: true,
            point: candidate,
            sourceId: geometry.id,
            type: 'vertex',
          }
        }
      })

      for (let i = 0; i < geometry.points.length - 1; i += 1) {
        const start = geometry.points[i]
        const end = geometry.points[i + 1]
        const { distance, projection } = distanceToSegment(point, start, end)
        if (distance < EDGE_THRESHOLD && (!closest.snapped || distance < distanceBetweenPoints(point, closest.point))) {
          closest = {
            snapped: true,
            point: projection,
            sourceId: geometry.id,
            type: 'edge',
          }
        }
      }

      if (geometry.type === 'polygon' && geometry.points.length > 2) {
        const start = geometry.points[geometry.points.length - 1]
        const end = geometry.points[0]
        const { distance, projection } = distanceToSegment(point, start, end)
        if (distance < EDGE_THRESHOLD && (!closest.snapped || distance < distanceBetweenPoints(point, closest.point))) {
          closest = {
            snapped: true,
            point: projection,
            sourceId: geometry.id,
            type: 'edge',
          }
        }
      }
    }
  })

  return closest
}
