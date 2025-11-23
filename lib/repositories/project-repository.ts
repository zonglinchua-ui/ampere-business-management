
/**
 * Project Repository
 * Centralized data access for projects
 */
import { Project, Prisma } from '@prisma/client'
import { BaseRepository, PaginationParams, PaginatedResult } from './base-repository'
import { prisma } from '../db'

export interface ProjectFilter {
  search?: string
  status?: string[]
  customerId?: string
  managerId?: string
  projectType?: string[]
  isActive?: boolean
}

export interface ProjectWithRelations extends Project {
  _count?: {
    CustomerInvoice?: number
    ProgressClaim?: number
    VariationOrder?: number
    Document?: number
    Task?: number
  }
  customer?: {
    id: string
    name: string
  }
  manager?: {
    id: string
    name: string
  }
  actualSpent?: number
  totalClaimed?: number
}

export class ProjectRepository extends BaseRepository<Project> {
  constructor() {
    super('project')
  }

  /**
   * Find projects with pagination and filters
   */
  async findProjects(
    filter: ProjectFilter = {},
    pagination?: PaginationParams,
    include?: any,
    orderBy?: any
  ): Promise<PaginatedResult<Project>> {
    const where: Prisma.ProjectWhereInput = {
      ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter.status && { status: { in: filter.status as any } }),
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(filter.managerId && { managerId: filter.managerId }),
      ...(filter.projectType && { projectType: { in: filter.projectType as any } }),
      ...(filter.search && this.buildProjectSearchQuery(filter.search)),
    }

    return this.findWithPagination(where, pagination, include, orderBy)
  }

  /**
   * Find projects with aggregated financial data
   */
  async findProjectsWithFinancials(
    filter: ProjectFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<ProjectWithRelations>> {
    const result = await this.findProjects(
      filter,
      pagination,
      {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            CustomerInvoice: true,
            ProgressClaim: true,
            VariationOrder: true,
            Document: true,
            Task: true,
          },
        },
      },
      orderBy
    )

    // Calculate financial aggregates
    const dataWithFinancials = await Promise.all(
      result.data.map(async (project: any) => {
        const [actualSpent, totalClaimed] = await Promise.all([
          this.calculateActualSpent(project.id),
          this.calculateTotalClaimed(project.id),
        ])

        return {
          ...project,
          actualSpent,
          totalClaimed,
        }
      })
    )

    return {
      ...result,
      data: dataWithFinancials,
    }
  }

  /**
   * Create project with auto-generated project number
   */
  async createProject(data: Omit<Prisma.ProjectCreateInput, 'projectNumber'>): Promise<Project> {
    const projectNumber = await this.generateProjectNumber(
      (data as any).projectType || 'REGULAR'
    )

    return await prisma.project.create({
      data: {
        ...data,
        projectNumber,
      } as Prisma.ProjectCreateInput,
    })
  }

  /**
   * Update project
   */
  async updateProject(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return await prisma.project.update({
      where: { id },
      data,
    })
  }

  /**
   * Calculate actual spent for a project
   */
  private async calculateActualSpent(projectId: string): Promise<number> {
    const result = await prisma.projectTransaction.aggregate({
      where: {
        projectId,
        transactionType: 'EXPENSE',
      },
      _sum: {
        amount: true,
      },
    })

    const purchaseOrders = await prisma.purchaseOrder.aggregate({
      where: {
        projectId,
        status: 'APPROVED', // Only count approved POs
      },
      _sum: {
        totalAmount: true,
      },
    })

    return Number(result._sum?.amount || 0) + Number(purchaseOrders._sum?.totalAmount || 0)
  }

  /**
   * Calculate total claimed for a project
   */
  private async calculateTotalClaimed(projectId: string): Promise<number> {
    const result = await prisma.customerInvoice.aggregate({
      where: {
        projectId,
        isProgressClaimInvoice: true,
        status: { notIn: ['CANCELLED'] }, // Only exclude cancelled
      },
      _sum: {
        totalAmount: true,
      },
    })

    return Number(result._sum?.totalAmount || 0)
  }

  /**
   * Generate project number
   */
  private async generateProjectNumber(projectType: 'REGULAR' | 'MAINTENANCE'): Promise<string> {
    const prefix = projectType === 'MAINTENANCE' ? 'MNT' : 'PRJ'
    const currentYear = new Date().getFullYear()

    const lastProject = await prisma.project.findFirst({
      where: {
        projectType,
        projectNumber: {
          startsWith: `${prefix}-${currentYear}-`,
        },
      },
      orderBy: {
        projectNumber: 'desc',
      },
    })

    let nextNumber = 1
    if (lastProject) {
      const parts = lastProject.projectNumber.split('-')
      const lastNumber = parseInt(parts[2], 10)
      nextNumber = lastNumber + 1
    }

    return `${prefix}-${currentYear}-${nextNumber.toString().padStart(3, '0')}`
  }

  /**
   * Build search query for projects
   */
  private buildProjectSearchQuery(search: string): Prisma.ProjectWhereInput {
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { projectNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }
  }
}
