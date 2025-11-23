import crypto from "crypto"

export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type Polygon = Array<[number, number]>

export type DetectedElementResult = {
  type: string
  polygon?: Polygon
  boundingBox?: BoundingBox
  confidence: number
}

export type TakeoffDetectionInput = {
  planSheetId: string
  imageUrl?: string
  version: number
  name?: string
}

export interface TakeoffDetectionEngine {
  name: string
  detect: (input: TakeoffDetectionInput) => Promise<DetectedElementResult[]>
}

const DEFAULT_FRAME_SIZE = 1024

function seededRandom(seed: string) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex")
  let idx = 0

  return () => {
    const slice = hash.slice(idx, idx + 8)
    idx = (idx + 8) % hash.length
    return parseInt(slice, 16) / 0xffffffff
  }
}

function polygonFromSeed(seed: string, scale = DEFAULT_FRAME_SIZE): Polygon {
  const random = seededRandom(seed)
  const originX = random() * scale * 0.6
  const originY = random() * scale * 0.6
  const width = scale * 0.2 + random() * scale * 0.2
  const height = scale * 0.2 + random() * scale * 0.2

  return [
    [originX, originY],
    [originX + width, originY],
    [originX + width, originY + height],
    [originX, originY + height],
  ]
}

function boundingBoxFromPolygon(polygon: Polygon): BoundingBox {
  const xs = polygon.map((point) => point[0])
  const ys = polygon.map((point) => point[1])

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function createMockDetector(): TakeoffDetectionEngine {
  const elementTypes = ["wall", "opening", "dimension", "annotation"]

  return {
    name: "mock-contour-detector",
    async detect(input: TakeoffDetectionInput): Promise<DetectedElementResult[]> {
      const seed = `${input.planSheetId}-${input.version}-${input.imageUrl ?? "placeholder"}`
      const random = seededRandom(seed)

      return elementTypes.map((type, index) => {
        const polygon = polygonFromSeed(`${seed}-${index}`)
        const confidence = 0.6 + random() * 0.35

        return {
          type,
          polygon,
          boundingBox: boundingBoxFromPolygon(polygon),
          confidence: Number(confidence.toFixed(3)),
        }
      })
    },
  }
}

export function getDetectionEngine(): TakeoffDetectionEngine {
  return createMockDetector()
}

export async function runTakeoffDetection(
  input: TakeoffDetectionInput,
  engine: TakeoffDetectionEngine = getDetectionEngine(),
): Promise<DetectedElementResult[]> {
  return engine.detect(input)
}
