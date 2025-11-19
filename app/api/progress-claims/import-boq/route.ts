
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

// POST /api/progress-claims/import-boq - Import BOQ from quotation or tender
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quotationId, tenderId, projectId } = body;

    if (!quotationId && !tenderId) {
      return NextResponse.json(
        { error: 'Either quotationId or tenderId is required' },
        { status: 400 }
      );
    }

    let boqItems: any[] = [];

    if (quotationId) {
      // Import from quotation
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: {
          QuotationItem: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      if (!quotation) {
        return NextResponse.json(
          { error: 'Quotation not found' },
          { status: 404 }
        );
      }

      boqItems = quotation.QuotationItem.map((item, index) => ({
        itemNumber: index + 1,
        description: item.description,
        unit: item.unit || 'pcs',
        unitRate: parseFloat(item.unitPrice.toString()),
        totalQuantity: parseFloat(item.quantity.toString()),
        totalAmount: parseFloat(item.totalPrice.toString()),
        previousClaimedQty: 0,
        previousClaimedPct: 0,
        previousClaimedAmount: 0,
        currentClaimQty: 0,
        currentClaimPct: 0,
        currentClaimAmount: 0,
        cumulativeQty: 0,
        cumulativePct: 0,
        cumulativeAmount: 0,
        notes: item.notes || null,
      }));
    } else if (tenderId) {
      // For tenders, we'd need to have a tender items structure
      // For now, return empty array or implement tender BOQ structure
      return NextResponse.json(
        { error: 'Tender BOQ import not yet implemented' },
        { status: 400 }
      );
    }

    // If projectId is provided, calculate previous claimed amounts
    if (projectId) {
      const previousClaims = await prisma.progressClaim.findMany({
        where: {
          projectId,
          status: {
            in: ['APPROVED', 'INVOICED'],
          },
        },
        include: {
          items: true,
        },
      });

      // Update BOQ items with previous claims
      boqItems = boqItems.map((boqItem) => {
        const previousItemClaims = previousClaims.flatMap((claim: any) =>
          claim.items.filter((i) => i.description === boqItem.description)
        );

        if (previousItemClaims.length > 0) {
          const previousClaimedQty = previousItemClaims.reduce(
            (sum, i) => sum + parseFloat(i.currentClaimQty.toString()),
            0
          );
          const previousClaimedPct = (previousClaimedQty / boqItem.totalQuantity) * 100;
          const previousClaimedAmount = (previousClaimedQty / boqItem.totalQuantity) * boqItem.totalAmount;

          return {
            ...boqItem,
            previousClaimedQty,
            previousClaimedPct,
            previousClaimedAmount,
          };
        }

        return boqItem;
      });
    }

    return NextResponse.json({
      items: boqItems,
      totalItems: boqItems.length,
    });
  } catch (error) {
    console.error('Error importing BOQ:', error);
    return NextResponse.json(
      { error: 'Failed to import BOQ' },
      { status: 500 }
    );
  }
}
