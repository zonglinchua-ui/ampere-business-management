
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/api-audit-context';
import { canEditAnyProgressClaim } from '@/lib/permissions';

// GET /api/progress-claims/[id] - Get a specific progress claim
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progressClaim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          include: {
            Customer: true,
          },
        },
        Quotation: {
          include: {
            QuotationItem: true,
          },
        },
        Tender: true,
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ApprovedByClient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        CustomerInvoice: true,
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

    return NextResponse.json(progressClaim);
  } catch (error) {
    console.error('Error fetching progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress claim' },
      { status: 500 }
    );
  }
}

// PATCH /api/progress-claims/[id] - Update a progress claim
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      claimTitle,
      description,
      retentionPercentage,
      items,
    } = body;

    // Get existing claim
    const existingClaim = await prisma.progressClaim.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        Project: {
          include: {
            Customer: true,
          },
        },
      },
    });

    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    // Only allow updates if status is DRAFT or user is SUPERADMIN
    if (existingClaim.status !== 'DRAFT' && (!user || !canEditAnyProgressClaim(user.role as any))) {
      return NextResponse.json(
        { error: 'Only SUPERADMIN can edit submitted, approved, or invoiced claims. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Calculate totals
    let currentClaimAmount = 0;
    const claimItems = items.map((item: any, index: number) => {
      const totalAmount = parseFloat(item.totalQuantity) * parseFloat(item.unitRate);
      const currentClaimQty = parseFloat(item.currentClaimQty || 0);
      const currentClaimPct = (currentClaimQty / parseFloat(item.totalQuantity)) * 100;
      const currentClaimAmt = (currentClaimQty / parseFloat(item.totalQuantity)) * totalAmount;

      currentClaimAmount += currentClaimAmt;

      return {
        ...item,
        itemNumber: index + 1,
        totalAmount,
        currentClaimPct,
        currentClaimAmount: currentClaimAmt,
        cumulativeQty: parseFloat(item.previousClaimedQty || 0) + currentClaimQty,
        cumulativePct:
          ((parseFloat(item.previousClaimedQty || 0) + currentClaimQty) /
            parseFloat(item.totalQuantity)) *
          100,
        cumulativeAmount:
          parseFloat(item.previousClaimedAmount || 0) + currentClaimAmt,
      };
    });

    const retentionAmt = retentionPercentage ? (currentClaimAmount * parseFloat(retentionPercentage)) / 100 : 0;
    const netClaimAmount = currentClaimAmount - retentionAmt;

    // Delete old items and create new ones
    await prisma.progressClaimItem.deleteMany({
      where: { progressClaimId: params.id },
    });

    const updatedClaim = await prisma.progressClaim.update({
      where: { id: params.id },
      data: {
        claimTitle: claimTitle || existingClaim.claimTitle,
        description: description !== undefined ? description : existingClaim.description,
        currentClaimAmount,
        cumulativeAmount: parseFloat(existingClaim.previousClaimedAmount.toString()) + currentClaimAmount,
        retentionPercentage: retentionPercentage !== undefined ? parseFloat(retentionPercentage) : existingClaim.retentionPercentage,
        retentionAmount: retentionAmt,
        netClaimAmount,
        updatedAt: new Date(),
        items: {
          create: claimItems.map((item: any) => ({
            id: `pci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        },
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
      action: 'UPDATE',
      entityType: 'PROGRESS_CLAIM',
      entityId: updatedClaim.id,
      entityName: `${updatedClaim.claimNumber} - ${updatedClaim.claimTitle}`,
      oldValues: {
        netClaimAmount: existingClaim.netClaimAmount,
      },
      newValues: {
        netClaimAmount,
        projectName: existingClaim.Project.name,
        customerName: existingClaim.Project.Customer.name,
      },
    });

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error('Error updating progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to update progress claim' },
      { status: 500 }
    );
  }
}

// DELETE /api/progress-claims/[id] - Delete a progress claim
export async function DELETE(
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
        Project: true,
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Progress claim not found' },
        { status: 404 }
      );
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    // Only allow deletion if status is DRAFT or user is SUPERADMIN
    if (claim.status !== 'DRAFT' && (!user || !canEditAnyProgressClaim(user.role as any))) {
      return NextResponse.json(
        { error: 'Only SUPERADMIN can delete submitted, approved, or invoiced claims. Please contact your administrator.' },
        { status: 403 }
      );
    }

    await prisma.progressClaim.delete({
      where: { id: params.id },
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'DELETE',
      entityType: 'PROGRESS_CLAIM',
      entityId: claim.id,
      entityName: `${claim.claimNumber} - ${claim.claimTitle}`,
      oldValues: {
        projectName: claim.Project.name,
        status: claim.status,
        netClaimAmount: claim.netClaimAmount,
      },
      newValues: null,
    });

    return NextResponse.json({ message: 'Progress claim deleted successfully' });
  } catch (error) {
    console.error('Error deleting progress claim:', error);
    return NextResponse.json(
      { error: 'Failed to delete progress claim' },
      { status: 500 }
    );
  }
}
