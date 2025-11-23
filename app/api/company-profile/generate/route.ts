
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, filters } = body

    if (type === 'project-list') {
      // Build where clause for year range and work type filtering
      const whereClause: any = {
        status: filters?.status || undefined,
      }

      // Year range filtering
      if (filters?.yearFrom || filters?.yearTo) {
        whereClause.OR = []
        
        if (filters?.yearFrom && filters?.yearTo) {
          const fromDate = new Date(filters.yearFrom, 0, 1)
          const toDate = new Date(filters.yearTo, 11, 31, 23, 59, 59)
          
          whereClause.OR.push({
            startDate: { gte: fromDate, lte: toDate }
          })
          whereClause.OR.push({
            endDate: { gte: fromDate, lte: toDate }
          })
        } else if (filters?.yearFrom) {
          const fromDate = new Date(filters.yearFrom, 0, 1)
          whereClause.OR.push({
            startDate: { gte: fromDate }
          })
          whereClause.OR.push({
            endDate: { gte: fromDate }
          })
        } else if (filters?.yearTo) {
          const toDate = new Date(filters.yearTo, 11, 31, 23, 59, 59)
          whereClause.OR.push({
            startDate: { lte: toDate }
          })
          whereClause.OR.push({
            endDate: { lte: toDate }
          })
        }
      }

      // Work type filtering
      if (filters?.workTypes && filters.workTypes.length > 0) {
        whereClause.workType = { in: filters.workTypes }
      }

      // Generate project references list
      const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { startDate: 'desc' }
      })

      const projectList = projects.map((p: any) => ({
        projectNumber: p.projectNumber,
        projectName: p.name,
        customer: p.Customer.name,
        contractValue: p.contractValue ? Number(p.contractValue) : null,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        workType: p.workType,
        location: p.address || p.city || ""
      }))

      return NextResponse.json({ projectList })
    }

    if (type === 'customer-list') {
      // Generate customer list
      const customers = await prisma.customer.findMany({
        where: {
          isActive: true,
          isDeleted: false
        },
        include: {
          Project: {
            select: {
              id: true,
              name: true,
              contractValue: true,
              status: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      const customerList = customers.map((c: any) => ({
        name: c.name,
        contactPerson: c.contactPerson,
        email: c.email,
        phone: c.phone,
        totalProjects: c.Project.length,
        totalContractValue: c.Project.reduce((sum: number, p: any) => {
          return sum + (p.contractValue ? Number(p.contractValue) : 0)
        }, 0)
      }))

      return NextResponse.json({ customerList })
    }

    if (type === 'ongoing-projects') {
      // Generate ongoing projects list
      const ongoingProjects = await prisma.project.findMany({
        where: {
          status: 'IN_PROGRESS'
        },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { startDate: 'desc' }
      })

      const projectList = ongoingProjects.map((p: any) => ({
        projectNumber: p.projectNumber,
        projectName: p.name,
        customer: p.Customer.name,
        contractValue: p.contractValue ? Number(p.contractValue) : null,
        startDate: p.startDate,
        expectedCompletion: p.endDate,
        location: p.address || p.city || "",
        progress: p.progress || 0
      }))

      return NextResponse.json({ projectList })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('Error generating list:', error)
    return NextResponse.json(
      { error: 'Failed to generate list' },
      { status: 500 }
    )
  }
}
