
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/api-audit-context';

// POST /api/progress-claims/[id]/submit - Submit claim to client
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const claim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only submit draft claims' },
        { status: 400 }
      );
    }

    const updatedClaim = await prisma.progressClaim.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedToClientAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        items: true,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'SUBMIT',
      entityType: 'PROGRESS_CLAIM',
      entityId: updatedClaim.id,
      entityName: `${updatedClaim.claimNumber} - ${updatedClaim.claimTitle}`,
      oldValues: { status: claim.status },
      newValues: {
        status: 'SUBMITTED',
        projectName: claim.Project.name,
        customerName: claim.Project.Customer.name,
      },
    });

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error('Error submitting progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to submit progress claim' },
      { status: 500 }
    );
  }
}
