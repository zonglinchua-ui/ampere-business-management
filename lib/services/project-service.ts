
/**
 * Project Service
 * Business logic layer for projects
 */
import { Project } from '@prisma/client'
import { ProjectRepository, ProjectFilter, ProjectWithRelations } from '../repositories/project-repository'
import { PaginationParams, PaginatedResult } from '../repositories/base-repository'
import { cache } from '../cache/simple-cache'
import { v4 as uuidv4 } from 'uuid'

export class ProjectService {
  private repository: ProjectRepository

  constructor() {
    this.repository = new ProjectRepository()
  }

  /**
   * Get projects with caching
   */
  async getProjects(
    filter: ProjectFilter = {},
    pagination?: PaginationParams,
    orderBy?: any
  ): Promise<PaginatedResult<ProjectWithRelations>> {
    const cacheKey = `projects:${JSON.stringify({ filter, pagination, orderBy })}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        return await this.repository.findProjectsWithFinancials(filter, pagination, orderBy)
      },
      2 * 60 * 1000 // 2 minutes cache
    )
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string, includeRelations: boolean = false): Promise<any> {
    const cacheKey = `project:${id}:${includeRelations}`
    
    return await cache.getOrSet(
      cacheKey,
      async () => {
        if (includeRelations) {
          return await this.repository.findById(id, {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
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
          })
        }
        return await this.repository.findById(id)
      },
      5 * 60 * 1000 // 5 minutes cache
    )
  }

  /**
   * Create project
   */
  async createProject(data: any, createdById: string): Promise<Project> {
    const project = await this.repository.createProject({
      id: uuidv4(),
      ...data,
      createdById,
      updatedAt: new Date(),
    } as any)

    // Invalidate cache
    this.invalidateProjectCache()
    
    return project
  }

  /**
   * Update project
   */
  async updateProject(id: string, data: any): Promise<Project> {
    const project = await this.repository.updateProject(id, {
      ...data,
      updatedAt: new Date(),
    })

    // Invalidate cache
    this.invalidateProjectCache(id)
    
    return project
  }

  /**
   * Invalidate project cache
   */
  private invalidateProjectCache(id?: string) {
    if (id) {
      cache.delete(`project:${id}:true`)
      cache.delete(`project:${id}:false`)
    }
    cache.clear()
  }
}
