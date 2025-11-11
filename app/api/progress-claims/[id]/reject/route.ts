
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/api-audit-context';
import { calculateProjectProgressFromItems } from '@/lib/project-progress-calculator';

// POST /api/progress-claims/[id]/reject - Reject claim
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
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

    if (claim.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Can only reject submitted claims' },
        { status: 400 }
      );
    }

    const updatedClaim = await prisma.progressClaim.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectedByClientAt: new Date(),
        rejectionReason,
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

    // Recalculate project progress after rejection
    try {
      const progressUpdate = await calculateProjectProgressFromItems(updatedClaim.projectId);
      console.log(`✅ Project progress recalculated after rejection: ${progressUpdate.progress}% (Status: ${progressUpdate.status})`);
    } catch (progressError) {
      console.error('⚠️ Failed to update project progress:', progressError);
      // Don't fail the rejection if progress calculation fails
    }

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'REJECT',
      entityType: 'PROGRESS_CLAIM',
      entityId: updatedClaim.id,
      entityName: `${updatedClaim.claimNumber} - ${updatedClaim.claimTitle}`,
      oldValues: { status: claim.status },
      newValues: {
        status: 'REJECTED',
        rejectionReason,
        projectName: claim.Project.name,
        customerName: claim.Project.Customer.name,
      },
    });

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error('Error rejecting progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to reject progress claim' },
      { status: 500 }
    );
  }
}
