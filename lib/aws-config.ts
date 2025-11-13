
import { S3Client } from "@aws-sdk/client-s3"

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME,
    folderPrefix: process.env.AWS_FOLDER_PREFIX || ""
  }
}

export function createS3Client() {
  const config: any = {
    region: process.env.AWS_REGION || 'ap-southeast-1',
  }

  // Add credentials if provided
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  }

  // Add custom endpoint if provided (for S3-compatible services)
  if (process.env.AWS_ENDPOINT) {
    config.endpoint = process.env.AWS_ENDPOINT
    config.forcePathStyle = true // Required for custom endpoints
  }

  return new S3Client(config)
}
