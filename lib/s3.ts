
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand 
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createS3Client, getBucketConfig } from "./aws-config"

const s3Client = createS3Client()
const { bucketName, folderPrefix } = getBucketConfig()

export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const key = `${folderPrefix}project-documents/${Date.now()}-${fileName}`
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
  })

  await s3Client.send(command)
  return key
}

export async function downloadFile(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  return signedUrl
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  await s3Client.send(command)
}

export async function renameFile(oldKey: string, newKey: string): Promise<string> {
  // S3 doesn't support direct rename, so we copy and delete
  const downloadUrl = await downloadFile(oldKey)
  
  // Get the original file
  const response = await fetch(downloadUrl)
  const buffer = Buffer.from(await response.arrayBuffer())
  
  // Upload with new name
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: newKey,
    Body: buffer,
  })

  await s3Client.send(command)
  
  // Delete original
  await deleteFile(oldKey)
  
  return newKey
}

export async function getFileSize(key: string): Promise<number> {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const response = await s3Client.send(command)
  return response.ContentLength || 0
}

export function getFileUrl(key: string): string {
  return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${key}`
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error('No file body found')
  }

  const stream = response.Body as ReadableStream
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const buffer = new Uint8Array(totalLength)
  let offset = 0
  
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.length
  }

  return Buffer.from(buffer)
}
