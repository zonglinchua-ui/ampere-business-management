
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/api-audit-context';

// GET /api/progress-claims - List all progress claims
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Prisma.ProgressClaimWhereInput = {};
    if (projectId) {
      where.projectId = projectId;
    }
    if (status) {
      where.status = status as any;
    }

    const [claims, total] = await Promise.all([
      prisma.progressClaim.findMany({
        where,
        include: {
          Project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
              Customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          Quotation: {
            select: {
              id: true,
              quotationNumber: true,
              title: true,
            },
          },
          Tender: {
            select: {
              id: true,
              tenderNumber: true,
              title: true,
            },
          },
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
          items: {
            orderBy: {
              itemNumber: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.progressClaim.count({ where }),
    ]);

    return NextResponse.json({
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching progress claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress claims' },
      { status: 500 }
    );
  }
}

// POST /api/progress-claims - Create a new progress claim
export async function POST(request: NextRequest) {
  let body: any;
  try {
    console.log('=====================================');
    console.log('PROGRESS CLAIM POST REQUEST RECEIVED');
    console.log('=====================================');
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.log('Unauthorized: No session or user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', session.user.email);

    body = await request.json();
    console.log('Request body received, keys:', Object.keys(body));
    const {
      projectId,
      quotationId,
      tenderId,
      claimTitle,
      description,
      retentionPercentage,
      gstRate,
      items,
    } = body;

    if (!projectId || !claimTitle || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, claimTitle, and items are required' },
        { status: 400 }
      );
    }

    // Default GST rate to 9% if not provided
    const finalGstRate = gstRate !== undefined ? parseFloat(gstRate) : 9;

    // Validate items data
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Description is required` },
          { status: 400 }
        );
      }
      if (item.unitRate === undefined || item.unitRate === null || isNaN(parseFloat(item.unitRate))) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Invalid unit rate` },
          { status: 400 }
        );
      }
      if (item.totalQuantity === undefined || item.totalQuantity === null || isNaN(parseFloat(item.totalQuantity))) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Invalid total quantity` },
          { status: 400 }
        );
      }
      if (item.currentClaimQty === undefined || item.currentClaimQty === null || isNaN(parseFloat(item.currentClaimQty))) {
        return NextResponse.json(
          { error: `Item ${i + 1}: Invalid current claim quantity` },
          { status: 400 }
        );
      }
    }

    console.log('Creating progress claim with data:', {
      projectId,
      quotationId,
      tenderId,
      claimTitle,
      retentionPercentage,
      gstRate: finalGstRate,
      itemsCount: items.length,
    });

    // Get the project to verify it exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        Customer: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get the last claim number for this project
    const lastClaim = await prisma.progressClaim.findFirst({
      where: {
        projectId,
      },
      orderBy: {
        claimNumber: 'desc',
      },
    });

    // Generate claim number (e.g., PC-P001-001)
    let claimCounter = 1;
    if (lastClaim) {
      const match = lastClaim.claimNumber.match(/PC-.*-(\d+)$/);
      if (match) {
        claimCounter = parseInt(match[1]) + 1;
      }
    }
    const claimNumber = `PC-${project.projectNumber}-${claimCounter.toString().padStart(3, '0')}`;

    // Calculate previous claimed amounts from previous claims
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

    // Calculate totals
    let totalCurrentClaimAmount = 0;
    let totalPreviousClaimedAmount = 0;

    const claimItems = items.map((item: any, index: number) => {
      // Safely parse numeric values with fallbacks
      const unitRate = typeof item.unitRate === 'number' ? item.unitRate : parseFloat(item.unitRate || 0);
      const totalQty = typeof item.totalQuantity === 'number' ? item.totalQuantity : parseFloat(item.totalQuantity || 0);
      const currentClaimQty = typeof item.currentClaimQty === 'number' ? item.currentClaimQty : parseFloat(item.currentClaimQty || 0);
      
      // Calculate total amount
      const totalAmount = totalQty * unitRate;
      
      // Calculate current claim percentages and amounts
      const currentClaimPct = totalQty > 0 ? (currentClaimQty / totalQty) * 100 : 0;
      const currentClaimAmount = totalQty > 0 ? (currentClaimQty / totalQty) * totalAmount : 0;

      // Find previous claims for this item (matching by description)
      const previousItemClaims = previousClaims.flatMap((claim: any) =>
        claim.items.filter((i: any) => i.description === item.description)
      );

      const previousClaimedQty = previousItemClaims.reduce(
        (sum: any, i: any) => sum + parseFloat(i.currentClaimQty.toString()),
        0
      );
      const previousClaimedPct = totalQty > 0 ? (previousClaimedQty / totalQty) * 100 : 0;
      const previousClaimedAmt = totalQty > 0 ? (previousClaimedQty / totalQty) * totalAmount : 0;

      const cumulativeQty = previousClaimedQty + currentClaimQty;
      const cumulativePct = totalQty > 0 ? (cumulativeQty / totalQty) * 100 : 0;
      const cumulativeAmt = totalQty > 0 ? (cumulativeQty / totalQty) * totalAmount : 0;

      totalCurrentClaimAmount += currentClaimAmount;
      totalPreviousClaimedAmount += previousClaimedAmt;

      return {
        itemNumber: index + 1,
        description: item.description || '',
        unit: item.unit || 'pcs',
        unitRate,
        totalQuantity: totalQty,
        totalAmount,
        previousClaimedQty,
        previousClaimedPct,
        previousClaimedAmount: previousClaimedAmt,
        currentClaimQty,
        currentClaimPct,
        currentClaimAmount,
        cumulativeQty,
        cumulativePct,
        cumulativeAmount: cumulativeAmt,
        notes: item.notes || null,
      };
    });

    const cumulativeAmount = totalPreviousClaimedAmount + totalCurrentClaimAmount;
    const retentionAmt = retentionPercentage ? (totalCurrentClaimAmount * parseFloat(retentionPercentage)) / 100 : 0;
    
    // Calculate GST (applied after retention)
    const amountAfterRetention = totalCurrentClaimAmount - retentionAmt;
    const gstAmount = (amountAfterRetention * finalGstRate) / 100;
    const netClaimAmount = amountAfterRetention + gstAmount;

    // Validate calculated values
    if (isNaN(totalCurrentClaimAmount) || isNaN(cumulativeAmount) || isNaN(retentionAmt) || 
        isNaN(amountAfterRetention) || isNaN(gstAmount) || isNaN(netClaimAmount)) {
      console.error('Invalid calculated values:', {
        totalCurrentClaimAmount,
        cumulativeAmount,
        retentionAmt,
        amountAfterRetention,
        gstAmount,
        netClaimAmount,
      });
      return NextResponse.json(
        { error: 'Invalid calculated values. Please check your input data.' },
        { status: 400 }
      );
    }

    console.log('Progress claim calculations:', {
      totalPreviousClaimedAmount,
      totalCurrentClaimAmount,
      cumulativeAmount,
      retentionAmt,
      amountAfterRetention,
      gstAmount,
      netClaimAmount,
      finalGstRate,
    });

    // Create the progress claim
    const progressClaimId = `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Creating progress claim with:', {
      id: progressClaimId,
      claimNumber,
      projectId,
      itemsCount: claimItems.length,
    });

    const progressClaim = await prisma.progressClaim.create({
      data: {
        id: progressClaimId,
        claimNumber,
        projectId,
        quotationId: quotationId || null,
        tenderId: tenderId || null,
        claimTitle,
        description: description || null,
        previousClaimedAmount: Number(totalPreviousClaimedAmount) || 0,
        currentClaimAmount: Number(totalCurrentClaimAmount) || 0,
        cumulativeAmount: Number(cumulativeAmount) || 0,
        retentionPercentage: Number(retentionPercentage || 0),
        retentionAmount: Number(retentionAmt) || 0,
        subTotal: Number(amountAfterRetention) || 0,
        gstRate: Number(finalGstRate) || 9,
        gstAmount: Number(gstAmount) || 0,
        netClaimAmount: Number(netClaimAmount) || 0,
        createdById: session.user.id,
        updatedAt: new Date(),
        items: {
          create: claimItems.map((item: any, idx: number) => {
            const itemId = `pci_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`;
            console.log(`Creating item ${idx + 1}:`, {
              id: itemId,
              description: item.description,
              unitRate: item.unitRate,
              totalQuantity: item.totalQuantity,
              currentClaimQty: item.currentClaimQty,
            });
            // Ensure all numeric fields are valid numbers
            const itemData = {
              id: itemId,
              itemNumber: Number(item.itemNumber) || 0,
              description: String(item.description || ''),
              unit: String(item.unit || 'pcs'),
              unitRate: Number(item.unitRate) || 0,
              totalQuantity: Number(item.totalQuantity) || 0,
              totalAmount: Number(item.totalAmount) || 0,
              previousClaimedQty: Number(item.previousClaimedQty) || 0,
              previousClaimedPct: Number(item.previousClaimedPct) || 0,
              previousClaimedAmount: Number(item.previousClaimedAmount) || 0,
              currentClaimQty: Number(item.currentClaimQty) || 0,
              currentClaimPct: Number(item.currentClaimPct) || 0,
              currentClaimAmount: Number(item.currentClaimAmount) || 0,
              cumulativeQty: Number(item.cumulativeQty) || 0,
              cumulativePct: Number(item.cumulativePct) || 0,
              cumulativeAmount: Number(item.cumulativeAmount) || 0,
              notes: item.notes ? String(item.notes) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            console.log(`Item ${idx + 1} data:`, itemData);
            return itemData;
          }),
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
    
    console.log('Progress claim created successfully:', progressClaim.id);

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email || '',
      action: 'CREATE',
      entityType: 'PROGRESS_CLAIM',
      entityId: progressClaim.id,
      entityName: `${progressClaim.claimNumber} - ${progressClaim.claimTitle}`,
      oldValues: null,
      newValues: {
        projectName: project.name,
        customerName: project.Customer.name,
        netClaimAmount,
        status: progressClaim.status,
      },
    });

    return NextResponse.json(progressClaim, { status: 201 });
  } catch (error) {
    console.error('=====================================');
    console.error('PROGRESS CLAIM CREATION ERROR');
    console.error('=====================================');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : undefined);
    console.error('Request body:', body ? JSON.stringify(body, null, 2) : 'Body not parsed');
    
    // Log Prisma errors specifically
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as any).code);
      console.error('Prisma error meta:', (error as any).meta);
      errorDetails = `Prisma error ${(error as any).code}: ${error instanceof Error ? error.message : 'Unknown'}`;
    }
    
    console.error('=====================================');
    
    // Return detailed error to frontend for debugging
    return NextResponse.json(
      { 
        error: 'Failed to create progress claim',
        details: errorDetails,
        prismaCode: (error && typeof error === 'object' && 'code' in error) ? (error as any).code : undefined,
        prismaMeta: (error && typeof error === 'object' && 'meta' in error) ? (error as any).meta : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        requestData: body ? {
          projectId: body.projectId,
          claimTitle: body.claimTitle,
          itemsCount: body.items?.length || 0,
        } : undefined
      },
      { status: 500 }
    );
  }
}
