
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

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

    // Get all projects with customer information
    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
      },
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
        CompanyReference: {
          where: {
            companyProfileId: companyProfileId,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mark projects that are already added to the company profile
    const availableProjects = projects.map((project) => ({
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      description: project.description,
      projectType: project.projectType,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      contractValue: project.contractValue,
      estimatedBudget: project.estimatedBudget,
      progress: project.progress,
      address: project.address,
      city: project.city,
      country: project.country,
      postalCode: project.postalCode,
      customer: project.Customer,
      manager: project.User_Project_managerIdToUser,
      isAdded: project.CompanyReference.length > 0,
    }));

    return NextResponse.json({ projects: availableProjects }, { status: 200 });
  } catch (error) {
    console.error('Error fetching available projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available projects' },
      { status: 500 }
    );
  }
}
