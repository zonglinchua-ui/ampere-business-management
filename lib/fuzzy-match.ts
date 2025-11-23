
/**
 * Fuzzy matching utilities for intelligent string comparison
 * Handles variations in punctuation, spacing, abbreviations, and case
 */

/**
 * Normalize a string for comparison by removing punctuation, extra spaces,
 * and converting to lowercase
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 * (measures minimum number of edits needed to transform one string to another)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Calculate similarity ratio between two strings (0-1, where 1 is identical)
 */
export function similarityRatio(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Check if strings are similar enough based on a threshold
 */
export function isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  const normalized1 = normalizeString(str1)
  const normalized2 = normalizeString(str2)
  
  return similarityRatio(normalized1, normalized2) >= threshold
}

/**
 * Find the best match from a list of candidates
 * Returns the match with the highest similarity score above the threshold
 */
export function findBestMatch<T>(
  query: string,
  candidates: T[],
  getName: (candidate: T) => string,
  threshold: number = 0.75
): { match: T | null; score: number; confidence: 'high' | 'medium' | 'low' } {
  const normalizedQuery = normalizeString(query)
  
  let bestMatch: T | null = null
  let bestScore = 0
  
  for (const candidate of candidates) {
    const candidateName = getName(candidate)
    const normalizedCandidate = normalizeString(candidateName)
    
    // Calculate similarity
    const score = similarityRatio(normalizedQuery, normalizedCandidate)
    
    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }
  
  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (bestScore >= 0.9) {
    confidence = 'high'
  } else if (bestScore >= threshold) {
    confidence = 'medium'
  }
  
  // Only return match if score is above threshold
  if (bestScore >= threshold) {
    return { match: bestMatch, score: bestScore, confidence }
  }
  
  return { match: null, score: 0, confidence: 'low' }
}

/**
 * Check for common business name variations
 */
export function checkBusinessNameVariations(name1: string, name2: string): boolean {
  const normalized1 = normalizeString(name1)
  const normalized2 = normalizeString(name2)
  
  // Common suffixes that are often abbreviated or omitted
  const suffixes = [
    'pte ltd',
    'pteltd',
    'pte',
    'private limited',
    'pvt ltd',
    'pvtltd',
    'limited',
    'ltd',
    'llc',
    'inc',
    'incorporated',
    'corp',
    'corporation',
    'co',
    'company'
  ]
  
  // Remove all variations of suffixes
  let core1 = normalized1
  let core2 = normalized2
  
  for (const suffix of suffixes) {
    core1 = core1.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '').trim()
    core2 = core2.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '').trim()
  }
  
  // If core names match after removing suffixes, consider them the same
  if (core1 === core2 && core1.length > 0) {
    return true
  }
  
  // Check if they're very similar (>90% match)
  return similarityRatio(core1, core2) >= 0.9
}

/**
 * Comprehensive matching function that combines multiple strategies
 */
export function intelligentMatch<T>(
  query: string,
  candidates: T[],
  getName: (candidate: T) => string
): {
  match: T | null
  score: number
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'none'
  reason: string
} {
  if (!query || candidates.length === 0) {
    return { match: null, score: 0, confidence: 'none', reason: 'No query or candidates' }
  }
  
  const normalizedQuery = normalizeString(query)
  
  // 1. Check for exact match (case-insensitive, ignoring punctuation)
  for (const candidate of candidates) {
    const candidateName = getName(candidate)
    if (normalizeString(candidateName) === normalizedQuery) {
      return { 
        match: candidate, 
        score: 1.0, 
        confidence: 'exact', 
        reason: 'Exact match after normalization' 
      }
    }
  }
  
  // 2. Check for business name variations
  for (const candidate of candidates) {
    const candidateName = getName(candidate)
    if (checkBusinessNameVariations(query, candidateName)) {
      return { 
        match: candidate, 
        score: 0.95, 
        confidence: 'high', 
        reason: 'Core business name match (suffix variation)' 
      }
    }
  }
  
  // 3. Fuzzy match with high threshold
  const fuzzyResult = findBestMatch(query, candidates, getName, 0.75)
  
  if (fuzzyResult.match) {
    let confidence: 'exact' | 'high' | 'medium' | 'low' | 'none' = 'none'
    let reason = ''
    
    if (fuzzyResult.score >= 0.9) {
      confidence = 'high'
      reason = `Very similar (${(fuzzyResult.score * 100).toFixed(1)}% match)`
    } else if (fuzzyResult.score >= 0.8) {
      confidence = 'medium'
      reason = `Similar (${(fuzzyResult.score * 100).toFixed(1)}% match)`
    } else {
      confidence = 'low'
      reason = `Possible match (${(fuzzyResult.score * 100).toFixed(1)}% match)`
    }
    
    return {
      match: fuzzyResult.match,
      score: fuzzyResult.score,
      confidence,
      reason
    }
  }
  
  // 4. No match found
  return { 
    match: null, 
    score: 0, 
    confidence: 'none', 
    reason: 'No sufficiently similar match found' 
  }
}

