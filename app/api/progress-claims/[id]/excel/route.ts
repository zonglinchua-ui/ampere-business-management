
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateProgressClaimExcel } from '@/lib/progress-claim-pdf-utils';
import { uploadFile } from '@/lib/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the progress claim with all related data
    const progressClaim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        items: {
          orderBy: {
            itemNumber: 'asc',
          },
        },
      },
    });

    if (!progressClaim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    // Prepare the data for Excel generation
    const excelData = {
      id: progressClaim.id,
      claimNumber: progressClaim.claimNumber,
      claimTitle: progressClaim.claimTitle,
      claimDate: progressClaim.claimDate,
      description: progressClaim.description,
      status: progressClaim.status,
      currentClaimAmount: parseFloat(progressClaim.currentClaimAmount.toString()),
      previousClaimedAmount: parseFloat(progressClaim.previousClaimedAmount.toString()),
      cumulativeAmount: parseFloat(progressClaim.cumulativeAmount.toString()),
      retentionPercentage: parseFloat(progressClaim.retentionPercentage?.toString() || '0'),
      retentionAmount: parseFloat(progressClaim.retentionAmount?.toString() || '0'),
      netClaimAmount: parseFloat(progressClaim.netClaimAmount.toString()),
      currency: 'SGD',
      project: {
        name: progressClaim.Project.name,
        projectNumber: progressClaim.Project.projectNumber,
        address: progressClaim.Project.address,
      },
      customer: {
        name: progressClaim.Project.Customer.name,
        companyName: progressClaim.Project.Customer.name, // Using name as companyName
        email: progressClaim.Project.Customer.email,
        phone: progressClaim.Project.Customer.phone,
        address: progressClaim.Project.Customer.address,
        city: progressClaim.Project.Customer.city,
        postalCode: progressClaim.Project.Customer.postalCode,
      },
      items: progressClaim.items.map((item: any) => ({
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        unitRate: parseFloat(item.unitRate.toString()),
        totalQuantity: parseFloat(item.totalQuantity.toString()),
        previousClaimedQty: parseFloat(item.previousClaimedQty.toString()),
        previousClaimedPct: parseFloat(item.previousClaimedPct.toString()),
        currentClaimQty: parseFloat(item.currentClaimQty.toString()),
        currentClaimPct: parseFloat(item.currentClaimPct.toString()),
        cumulativePct: parseFloat(item.cumulativePct.toString()),
        currentClaimAmount: parseFloat(item.currentClaimAmount.toString()),
      })),
    };

    // Generate Excel
    const excelBuffer = await generateProgressClaimExcel(excelData);

    // Upload to S3
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `progress-claim-${progressClaim.claimNumber}-${timestamp}.xlsx`;
    const cloudStoragePath = await uploadFile(excelBuffer, filename);

    // Generate signed URL for download
    const { bucketName } = getBucketConfig();
    const s3Client = createS3Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cloudStoragePath,
    });
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({
      downloadUrl,
      filename,
    });
  } catch (error) {
    console.error('Error generating progress claim Excel:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    );
  }
}
