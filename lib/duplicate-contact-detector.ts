import { prisma } from '@/lib/db'
import Levenshtein from 'fast-levenshtein'

export interface DuplicateGroup {
  id: string
  contacts: DuplicateContact[]
  similarityScore: number
  suggestedMerge: string // ID of the contact to keep
}

export interface DuplicateContact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  isCustomer: boolean
  isSupplier: boolean
  xeroContactId?: string | null
  createdAt: Date
}

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim()
}

/**
 * Calculate similarity between two strings (0-1, where 1 is identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1)
  const norm2 = normalizeString(str2)
  
  if (norm1 === norm2) return 1.0
  
  const maxLen = Math.max(norm1.length, norm2.length)
  if (maxLen === 0) return 1.0
  
  const distance = Levenshtein.get(norm1, norm2)
  return 1 - (distance / maxLen)
}

/**
 * Check if two contacts are likely duplicates
 */
function areLikelyDuplicates(contact1: DuplicateContact, contact2: DuplicateContact): number {
  // Name similarity is the primary factor
  const nameSimilarity = calculateSimilarity(contact1.name, contact2.name)
  
  // If names are very different, not duplicates
  if (nameSimilarity < 0.7) return 0
  
  let score = nameSimilarity * 0.6 // Name accounts for 60% of score
  
  // Email match adds 20%
  if (contact1.email && contact2.email) {
    if (normalizeString(contact1.email) === normalizeString(contact2.email)) {
      score += 0.2
    }
  }
  
  // Phone match adds 20%
  if (contact1.phone && contact2.phone) {
    const phone1 = contact1.phone.replace(/\D/g, '') // Remove non-digits
    const phone2 = contact2.phone.replace(/\D/g, '')
    if (phone1 && phone2 && phone1 === phone2) {
      score += 0.2
    }
  }
  
  return score
}

/**
 * Detect duplicate contacts in the database
 */
export async function detectDuplicateContacts(
  threshold: number = 0.8
): Promise<DuplicateGroup[]> {
  console.log('[Duplicate Detector] Starting duplicate detection...')
  
  // Fetch all contacts
  const contacts = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isCustomer: true,
      isSupplier: true,
      xeroContactId: true,
      createdAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  console.log(`[Duplicate Detector] Analyzing ${contacts.length} contacts...`)

  const duplicateGroups: DuplicateGroup[] = []
  const processedIds = new Set<string>()

  // Compare each contact with every other contact
  for (let i = 0; i < contacts.length; i++) {
    if (processedIds.has(contacts[i].id)) continue

    const group: DuplicateContact[] = [contacts[i]]
    processedIds.add(contacts[i].id)

    for (let j = i + 1; j < contacts.length; j++) {
      if (processedIds.has(contacts[j].id)) continue

      const similarity = areLikelyDuplicates(contacts[i], contacts[j])
      
      if (similarity >= threshold) {
        group.push(contacts[j])
        processedIds.add(contacts[j].id)
      }
    }

    // If we found duplicates, add to results
    if (group.length > 1) {
      // Suggest keeping the oldest contact with Xero ID, or just the oldest
      const suggested = group.reduce((best, current) => {
        if (current.xeroContactId && !best.xeroContactId) return current
        if (!current.xeroContactId && best.xeroContactId) return best
        return current.createdAt < best.createdAt ? current : best
      })

      duplicateGroups.push({
        id: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        contacts: group,
        similarityScore: areLikelyDuplicates(group[0], group[1]),
        suggestedMerge: suggested.id,
      })
    }
  }

  console.log(`[Duplicate Detector] Found ${duplicateGroups.length} duplicate groups`)
  
  return duplicateGroups.sort((a, b) => b.similarityScore - a.similarityScore)
}

/**
 * Get duplicate statistics
 */
export async function getDuplicateStats() {
  const duplicates = await detectDuplicateContacts()
  
  const totalDuplicates = duplicates.reduce((sum, group) => sum + group.contacts.length, 0)
  const highConfidence = duplicates.filter(g => g.similarityScore >= 0.9).length
  const mediumConfidence = duplicates.filter(g => g.similarityScore >= 0.8 && g.similarityScore < 0.9).length
  
  return {
    totalGroups: duplicates.length,
    totalDuplicates,
    highConfidence,
    mediumConfidence,
    duplicates: duplicates.slice(0, 50), // Return top 50
  }
}

/**
 * Find specific duplicates for a contact
 */
export async function findDuplicatesForContact(contactId: string): Promise<DuplicateContact[]> {
  const contact = await prisma.customer.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isCustomer: true,
      isSupplier: true,
      xeroContactId: true,
      createdAt: true,
    },
  })

  if (!contact) {
    throw new Error('Contact not found')
  }

  const allContacts = await prisma.customer.findMany({
    where: {
      id: { not: contactId },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isCustomer: true,
      isSupplier: true,
      xeroContactId: true,
      createdAt: true,
    },
  })

  const duplicates: DuplicateContact[] = []

  for (const other of allContacts) {
    const similarity = areLikelyDuplicates(contact, other)
    if (similarity >= 0.7) {
      duplicates.push(other)
    }
  }

  return duplicates.sort((a, b) => {
    const simA = areLikelyDuplicates(contact, a)
    const simB = areLikelyDuplicates(contact, b)
    return simB - simA
  })
}

