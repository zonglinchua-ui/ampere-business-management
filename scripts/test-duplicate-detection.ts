/**
 * Test script for duplicate contact detection
 * Run with: npx ts-node scripts/test-duplicate-detection.ts
 */

import { detectDuplicateContacts, getDuplicateStats } from '../lib/duplicate-contact-detector'

async function main() {
  console.log('🔍 Testing duplicate contact detection...\n')

  try {
    // Test 1: Get duplicate statistics
    console.log('📊 Test 1: Getting duplicate statistics...')
    const stats = await getDuplicateStats()
    console.log('Stats:', JSON.stringify(stats, null, 2))
    console.log(`✅ Found ${stats.totalGroups} duplicate groups with ${stats.totalDuplicates} total duplicates\n`)

    // Test 2: Get full duplicate list
    console.log('📋 Test 2: Getting full duplicate list...')
    const duplicates = await detectDuplicateContacts(0.8)
    console.log(`✅ Found ${duplicates.length} duplicate groups\n`)

    // Test 3: Display first few duplicates
    if (duplicates.length > 0) {
      console.log('📝 Sample duplicates:')
      duplicates.slice(0, 3).forEach((group, index) => {
        console.log(`\nGroup ${index + 1} (Similarity: ${(group.similarityScore * 100).toFixed(0)}%):`)
        group.contacts.forEach((contact) => {
          console.log(`  - ${contact.name} (${contact.email || 'no email'}) ${contact.id === group.suggestedMerge ? '← SUGGESTED' : ''}`)
        })
      })
    } else {
      console.log('ℹ️  No duplicates found')
    }

    console.log('\n✅ All tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main()

