
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateProgressClaimPDF } from '@/lib/progress-claim-pdf-utils';

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

    // Calculate GST based on project country (default 9% for Singapore)
    const isOverseas = progressClaim.Project.country && progressClaim.Project.country.toLowerCase() !== 'singapore';
    const gstRate = isOverseas ? 0 : (progressClaim.gstRate ? parseFloat(progressClaim.gstRate.toString()) : 9);
    const cumulativeAmountNum = parseFloat(progressClaim.cumulativeAmount.toString());
    const retentionAmountNum = parseFloat((progressClaim.retentionAmount || 0).toString());
    const subTotal = cumulativeAmountNum - retentionAmountNum;
    const gstAmount = subTotal * (gstRate / 100);
    const netAmount = subTotal + gstAmount;

    // Prepare the data for PDF generation
    const pdfData = {
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
      gstRate: gstRate,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      subTotal: parseFloat(subTotal.toString()),
      netClaimAmount: parseFloat(netAmount.toFixed(2)),
      currency: 'SGD',
      project: {
        name: progressClaim.Project.name,
        projectNumber: progressClaim.Project.projectNumber,
        address: progressClaim.Project.address,
        country: progressClaim.Project.country,
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

    // Generate PDF
    const pdfBuffer = await generateProgressClaimPDF(pdfData);

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${progressClaim.claimNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating progress claim PDF:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      error: error
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF preview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
