import { prisma } from '@/lib/db'
import Levenshtein from 'fast-levenshtein'

export interface DuplicateGroup {
  id: string
  contacts: DuplicateContact[]
  similarityScore: number
  suggestedMerge: string // ID of the contact to keep
  matchReasons: string[] // Why these are considered duplicates
}

export interface DuplicateContact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  isCustomer: boolean | null
  isSupplier: boolean | null
  xeroContactId?: string | null
  createdAt: Date
}

// Common company suffixes to normalize
const COMPANY_SUFFIXES = [
  'pte ltd',
  'pte. ltd',
  'pte. ltd.',
  'private limited',
  'pvt ltd',
  'pvt. ltd',
  'limited',
  'ltd',
  'ltd.',
  'llp',
  'l.l.p',
  'l.l.p.',
  'inc',
  'inc.',
  'incorporated',
  'corporation',
  'corp',
  'corp.',
  'company',
  'co',
  'co.',
  'llc',
  'l.l.c',
  'l.l.c.',
  'sdn bhd',
  'sdn. bhd',
  'sdn. bhd.',
  'bhd',
  'berhad',
]

// Common word substitutions
const WORD_SUBSTITUTIONS: Record<string, string[]> = {
  'and': ['&', 'n'],
  '&': ['and', 'n'],
  'company': ['co', 'coy'],
  'co': ['company', 'coy'],
  'private': ['pvt', 'pte'],
  'pte': ['private', 'pvt'],
  'pvt': ['private', 'pte'],
  'limited': ['ltd'],
  'ltd': ['limited'],
  'design': ['dsn', 'dsgn'],
  'construction': ['const', 'constr', 'constn'],
  'engineering': ['eng', 'engg', 'engr'],
  'services': ['svc', 'svcs', 'serv'],
  'international': ['intl', 'int'],
  'management': ['mgmt', 'mgt'],
  'development': ['dev', 'devt', 'devel'],
  'technology': ['tech'],
  'solutions': ['soln', 'solns'],
}

/**
 * Enhanced normalization that handles company names intelligently
 */
function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase().trim()
  
  // Remove common punctuation but preserve word boundaries
  normalized = normalized
    .replace(/[.,;:!?'"()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Remove company suffixes for better matching
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix}\\b$`, 'i')
    normalized = normalized.replace(regex, '').trim()
  }
  
  return normalized
}

/**
 * Get all variations of a company name by applying substitutions
 */
function getNameVariations(name: string): string[] {
  const normalized = normalizeCompanyName(name)
  const words = normalized.split(/\s+/)
  const variations: Set<string> = new Set([normalized])
  
  // Generate variations by substituting words
  words.forEach((word, index) => {
    const substitutions = WORD_SUBSTITUTIONS[word]
    if (substitutions) {
      substitutions.forEach((sub) => {
        const newWords = [...words]
        newWords[index] = sub
        variations.add(newWords.join(' '))
      })
    }
  })
  
  return Array.from(variations)
}

/**
 * Calculate advanced similarity between two company names
 * Returns a score between 0 and 1
 */
function calculateAdvancedSimilarity(name1: string, name2: string): { score: number; reasons: string[] } {
  const reasons: string[] = []
  
  // Exact match after normalization
  const norm1 = normalizeCompanyName(name1)
  const norm2 = normalizeCompanyName(name2)
  
  if (norm1 === norm2) {
    reasons.push('Exact match after normalization')
    return { score: 1.0, reasons }
  }
  
  // Check if one is a variation of the other
  const variations1 = getNameVariations(name1)
  const variations2 = getNameVariations(name2)
  
  for (const v1 of variations1) {
    for (const v2 of variations2) {
      if (v1 === v2) {
        reasons.push('Matching variation (e.g., "and" vs "&")')
        return { score: 0.95, reasons }
      }
    }
  }
  
  // Calculate Levenshtein distance on normalized names
  const maxLen = Math.max(norm1.length, norm2.length)
  if (maxLen === 0) return { score: 1.0, reasons: ['Both names empty'] }
  
  const distance = Levenshtein.get(norm1, norm2)
  const levenshteinScore = 1 - (distance / maxLen)
  
  // Token-based similarity (Jaccard similarity)
  const tokens1 = new Set(norm1.split(/\s+/))
  const tokens2 = new Set(norm2.split(/\s+/))
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)))
  const union = new Set([...tokens1, ...tokens2])
  
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0
  
  // Check for common tokens
  if (intersection.size > 0) {
    reasons.push(`${intersection.size} common word(s): ${Array.from(intersection).join(', ')}`)
  }
  
  // Word order invariant similarity
  const sortedTokens1 = Array.from(tokens1).sort().join(' ')
  const sortedTokens2 = Array.from(tokens2).sort().join(' ')
  const orderInvariantMatch = sortedTokens1 === sortedTokens2
  
  if (orderInvariantMatch) {
    reasons.push('Same words in different order')
    return { score: 0.9, reasons }
  }
  
  // Combine scores with weights
  // 50% Levenshtein, 50% Jaccard
  const combinedScore = (levenshteinScore * 0.5) + (jaccardScore * 0.5)
  
  if (combinedScore >= 0.7) {
    reasons.push(`High similarity (${(combinedScore * 100).toFixed(0)}%)`)
  }
  
  return { score: combinedScore, reasons }
}

/**
 * Check if two contacts are likely duplicates with enhanced AI detection
 */
function areLikelyDuplicates(contact1: DuplicateContact, contact2: DuplicateContact): { score: number; reasons: string[] } {
  const reasons: string[] = []
  
  // Name similarity is the primary factor
  const nameResult = calculateAdvancedSimilarity(contact1.name, contact2.name)
  
  // If names are very different, not duplicates
  if (nameResult.score < 0.65) {
    return { score: 0, reasons: ['Names too different'] }
  }
  
  reasons.push(...nameResult.reasons)
  
  let score = nameResult.score * 0.6 // Name accounts for 60% of score
  
  // Email match adds 20%
  if (contact1.email && contact2.email) {
    const email1 = contact1.email.toLowerCase().trim()
    const email2 = contact2.email.toLowerCase().trim()
    
    if (email1 === email2) {
      score += 0.2
      reasons.push('Exact email match')
    } else {
      // Check if email domains match
      const domain1 = email1.split('@')[1]
      const domain2 = email2.split('@')[1]
      if (domain1 && domain2 && domain1 === domain2) {
        score += 0.1
        reasons.push('Same email domain')
      }
    }
  }
  
  // Phone match adds 20%
  if (contact1.phone && contact2.phone) {
    const phone1 = contact1.phone.replace(/\D/g, '') // Remove non-digits
    const phone2 = contact2.phone.replace(/\D/g, '')
    
    if (phone1 && phone2) {
      if (phone1 === phone2) {
        score += 0.2
        reasons.push('Exact phone match')
      } else {
        // Check last 8 digits (Singapore phone numbers)
        const last8_1 = phone1.slice(-8)
        const last8_2 = phone2.slice(-8)
        if (last8_1 === last8_2 && last8_1.length === 8) {
          score += 0.15
          reasons.push('Same phone number (last 8 digits)')
        }
      }
    }
  }
  
  return { score, reasons }
}

/**
 * Detect duplicate contacts in the database with enhanced AI detection
 */
export async function detectDuplicateContactsEnhanced(
  threshold: number = 0.75
): Promise<DuplicateGroup[]> {
  console.log('[Enhanced Duplicate Detector] Starting AI-powered duplicate detection...')
  console.log(`[Enhanced Duplicate Detector] Threshold: ${threshold} (${(threshold * 100).toFixed(0)}%)`)
  
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

  console.log(`[Enhanced Duplicate Detector] Analyzing ${contacts.length} contacts...`)

  const duplicateGroups: DuplicateGroup[] = []
  const processedIds = new Set<string>()

  // Compare each contact with every other contact
  for (let i = 0; i < contacts.length; i++) {
    if (processedIds.has(contacts[i].id)) continue

    const group: DuplicateContact[] = [contacts[i]]
    const groupReasons: Set<string> = new Set()
    let maxSimilarity = 0
    
    processedIds.add(contacts[i].id)

    for (let j = i + 1; j < contacts.length; j++) {
      if (processedIds.has(contacts[j].id)) continue

      const result = areLikelyDuplicates(contacts[i], contacts[j])
      
      if (result.score >= threshold) {
        group.push(contacts[j])
        processedIds.add(contacts[j].id)
        maxSimilarity = Math.max(maxSimilarity, result.score)
        result.reasons.forEach(r => groupReasons.add(r))
        
        console.log(`  ✓ Match: "${contacts[i].name}" ↔ "${contacts[j].name}" (${(result.score * 100).toFixed(0)}%)`)
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
        similarityScore: maxSimilarity || areLikelyDuplicates(group[0], group[1]).score,
        suggestedMerge: suggested.id,
        matchReasons: Array.from(groupReasons),
      })
    }
  }

  console.log(`[Enhanced Duplicate Detector] Found ${duplicateGroups.length} duplicate groups`)
  
  return duplicateGroups.sort((a, b) => b.similarityScore - a.similarityScore)
}

/**
 * Get duplicate statistics with enhanced detection
 */
export async function getDuplicateStatsEnhanced() {
  const duplicates = await detectDuplicateContactsEnhanced()
  
  const totalDuplicates = duplicates.reduce((sum, group) => sum + group.contacts.length, 0)
  const highConfidence = duplicates.filter(g => g.similarityScore >= 0.9).length
  const mediumConfidence = duplicates.filter(g => g.similarityScore >= 0.75 && g.similarityScore < 0.9).length
  const lowConfidence = duplicates.filter(g => g.similarityScore >= 0.65 && g.similarityScore < 0.75).length
  
  return {
    totalGroups: duplicates.length,
    totalDuplicates,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    duplicates: duplicates.slice(0, 50), // Return top 50
  }
}

/**
 * Find specific duplicates for a contact with enhanced detection
 */
export async function findDuplicatesForContactEnhanced(contactId: string): Promise<Array<DuplicateContact & { score: number; reasons: string[] }>> {
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

  const duplicates: Array<DuplicateContact & { score: number; reasons: string[] }> = []

  for (const other of allContacts) {
    const result = areLikelyDuplicates(contact, other)
    if (result.score >= 0.65) {
      duplicates.push({
        ...other,
        score: result.score,
        reasons: result.reasons,
      })
    }
  }

  return duplicates.sort((a, b) => b.score - a.score)
}

