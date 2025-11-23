import type { Point } from './types'

export function distanceBetweenPoints(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
  const segment = { x: end.x - start.x, y: end.y - start.y }
  const lengthSquared = segment.x * segment.x + segment.y * segment.y

  if (lengthSquared === 0) {
    const distance = distanceBetweenPoints(point, start)
    return { distance, projection: start }
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / lengthSquared),
  )

  const projection = { x: start.x + t * segment.x, y: start.y + t * segment.y }
  const distance = distanceBetweenPoints(point, projection)

  return { projection, distance }
}

export function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 }

  const { sumX, sumY } = points.reduce(
    (acc, point) => ({ sumX: acc.sumX + point.x, sumY: acc.sumY + point.y }),
    { sumX: 0, sumY: 0 },
  )

  return { x: sumX / points.length, y: sumY / points.length }
}
