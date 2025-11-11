
/**
 * Service Layer Index
 * Export all services from a single entry point
 */
import { ContactService } from './contact-service'
import { ProjectService } from './project-service'
import { InvoiceService } from './invoice-service'

export { ContactService, ProjectService, InvoiceService }

// Singleton instances for convenience
let contactServiceInstance: ContactService | null = null
let projectServiceInstance: ProjectService | null = null
let invoiceServiceInstance: InvoiceService | null = null

export function getContactService(): ContactService {
  if (!contactServiceInstance) {
    contactServiceInstance = new ContactService()
  }
  return contactServiceInstance
}

export function getProjectService(): ProjectService {
  if (!projectServiceInstance) {
    projectServiceInstance = new ProjectService()
  }
  return projectServiceInstance
}

export function getInvoiceService(): InvoiceService {
  if (!invoiceServiceInstance) {
    invoiceServiceInstance = new InvoiceService()
  }
  return invoiceServiceInstance
}
