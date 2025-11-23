
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    const body = await request.json();
    const { achievements, highlights, customNotes, isFeatured, includeInProfile, displayOrder } =
      body;

    const reference = await prisma.companyReference.update({
      where: { id },
      data: {
        achievements: achievements !== undefined ? achievements : undefined,
        highlights: highlights !== undefined ? highlights : undefined,
        customNotes: customNotes !== undefined ? customNotes : undefined,
        isFeatured: isFeatured !== undefined ? isFeatured : undefined,
        includeInProfile: includeInProfile !== undefined ? includeInProfile : undefined,
        displayOrder: displayOrder !== undefined ? displayOrder : undefined,
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

    return NextResponse.json({ reference }, { status: 200 });
  } catch (error) {
    console.error('Error updating company reference:', error);
    return NextResponse.json({ error: 'Failed to update company reference' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    await prisma.companyReference.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Reference deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting company reference:', error);
    return NextResponse.json({ error: 'Failed to delete company reference' }, { status: 500 });
  }
}
