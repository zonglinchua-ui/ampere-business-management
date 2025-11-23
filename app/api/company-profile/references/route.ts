
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const companyProfileId = searchParams.get('companyProfileId');

    if (!companyProfileId) {
      return NextResponse.json({ error: 'Company profile ID is required' }, { status: 400 });
    }

    const references = await prisma.companyReference.findMany({
      where: {
        companyProfileId: companyProfileId,
        includeInProfile: true,
      },
      include: {
        Project: {
          include: {
            Customer: {
              select: {
                id: true,
                name: true,
                companyReg: true,
              },
            },
            User_Project_managerIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return NextResponse.json({ references }, { status: 200 });
  } catch (error) {
    console.error('Error fetching company references:', error);
    return NextResponse.json({ error: 'Failed to fetch company references' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyProfileId, projectId, achievements, highlights, customNotes, isFeatured } = body;

    if (!companyProfileId || !projectId) {
      return NextResponse.json(
        { error: 'Company profile ID and project ID are required' },
        { status: 400 }
      );
    }

    // Check if reference already exists
    const existingReference = await prisma.companyReference.findFirst({
      where: {
        companyProfileId: companyProfileId,
        projectId: projectId,
      },
    });

    if (existingReference) {
      return NextResponse.json(
        { error: 'This project is already added to the company profile' },
        { status: 400 }
      );
    }

    // Get the maximum display order
    const maxOrder = await prisma.companyReference.findFirst({
      where: {
        companyProfileId: companyProfileId,
      },
      orderBy: {
        displayOrder: 'desc',
      },
      select: {
        displayOrder: true,
      },
    });

    const displayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;

    const reference = await prisma.companyReference.create({
      data: {
        id: uuidv4(),
        companyProfileId,
        projectId,
        achievements: achievements || null,
        highlights: highlights || null,
        customNotes: customNotes || null,
        isFeatured: isFeatured || false,
        displayOrder,
        includeInProfile: true,
        updatedAt: new Date(),
      },
      include: {
        Project: {
          include: {
            Customer: {
              select: {
                id: true,
                name: true,
                companyReg: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ reference }, { status: 201 });
  } catch (error) {
    console.error('Error creating company reference:', error);
    return NextResponse.json({ error: 'Failed to create company reference' }, { status: 500 });
  }
}
