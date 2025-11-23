
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


// GET /api/servicing/contracts/[id] - Get contract by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canView = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(userRole || "")
    
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const contract = await prisma.serviceContract.findUnique({
      where: { id: params.id },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            contactPerson: true
          }
        },
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            status: true,
            description: true
          }
        },
        User_ServiceContract_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        ServiceContractSupplier: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                supplierNumber: true,
                email: true,
                phone: true,
                contactPerson: true
              }
            }
          }
        },
        ServiceJob: {
          orderBy: {
            scheduledDate: 'asc'
          }
        },
        _count: {
          select: {
            ServiceJob: true
          }
        }
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Service contract not found' }, { status: 404 })
    }

    // Transform to match frontend expectations (camelCase)
    const transformedContract = {
      ...contract,
      customer: contract.Customer,
      project: contract.Project,
      createdBy: contract.User_ServiceContract_createdByIdToUser,
      suppliers: contract.ServiceContractSupplier || [],
      _count: {
        jobs: contract._count.ServiceJob
      }
    }

    return NextResponse.json(transformedContract)
  } catch (error) {
    console.error('Error fetching service contract:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/servicing/contracts/[id] - Update contract
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canUpdate = ["SUPERADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole || "")
    
    if (!canUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions to update contracts' }, { status: 403 })
    }

    const data = await request.json()

    // First, delete existing supplier relationships
    await prisma.serviceContractSupplier.deleteMany({
      where: { contractId: params.id }
    })

    // Prepare update data
    const updateData: any = {
      title: data.title,
      customerId: data.customerId,
      projectId: data.projectId || null,
      serviceType: data.serviceType,
      frequency: data.frequency,
      status: data.status,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate)
      // Note: updatedAt is automatically managed by Prisma @updatedAt
      // Note: notes field removed as it doesn't exist in schema
    }

    // Add supplier relationships if provided
    if (data.supplierIds && Array.isArray(data.supplierIds) && data.supplierIds.length > 0) {
      updateData.suppliers = {
        create: data.supplierIds.map((supplierId: string) => ({
          supplierId: supplierId
        }))
      }
    }

    const contract = await prisma.serviceContract.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
            phone: true
          }
        },
        Project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            status: true
          }
        },
        User_ServiceContract_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        ServiceContractSupplier: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                supplierNumber: true,
                email: true,
                phone: true
              }
            }
          }
        },
        _count: {
          select: {
            ServiceJob: true
          }
        }
      }
    })

    // Transform to match frontend expectations (camelCase)
    const transformedContract = {
      ...contract,
      customer: contract.Customer,
      project: contract.Project,
      createdBy: contract.User_ServiceContract_createdByIdToUser,
      suppliers: contract.ServiceContractSupplier || [],
      _count: {
        jobs: contract._count.ServiceJob
      }
    }

    return NextResponse.json(transformedContract)
  } catch (error) {
    console.error('Error updating service contract:', error)
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ 
      error: 'Failed to update contract',
      details: errorMessage 
    }, { status: 500 })
  }
}

// DELETE /api/servicing/contracts/[id] - Delete contract
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user?.role
    const canDelete = ["SUPERADMIN"].includes(userRole || "")
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions to delete contracts' }, { status: 403 })
    }

    await prisma.serviceContract.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Service contract deleted successfully' })
  } catch (error) {
    console.error('Error deleting service contract:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
