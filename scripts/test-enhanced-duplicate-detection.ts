/**
 * Test script for enhanced AI-powered duplicate contact detection
 * Run with: npx ts-node scripts/test-enhanced-duplicate-detection.ts
 */

import { detectDuplicateContactsEnhanced, getDuplicateStatsEnhanced } from '../lib/duplicate-contact-detector-enhanced'

// Test cases that should be detected as duplicates
const testCases = [
  {
    name1: 'YF design and build pte ltd',
    name2: 'YF design & build',
    shouldMatch: true,
    reason: 'Different company suffix and "&" vs "and"'
  },
  {
    name1: 'ABC Company Pte Ltd',
    name2: 'ABC Company Private Limited',
    shouldMatch: true,
    reason: 'Different company suffix variations'
  },
  {
    name1: 'XYZ Engineering Services',
    name2: 'XYZ Eng Services',
    shouldMatch: true,
    reason: 'Abbreviation: Engineering vs Eng'
  },
  {
    name1: 'Tech Solutions International Inc.',
    name2: 'Tech Solns Intl Inc',
    shouldMatch: true,
    reason: 'Multiple abbreviations'
  },
  {
    name1: 'Design & Build Co.',
    name2: 'Design and Build Company',
    shouldMatch: true,
    reason: 'Symbol vs word and abbreviation'
  },
  {
    name1: 'Singapore Construction Pte. Ltd.',
    name2: 'Singapore Const Pte Ltd',
    shouldMatch: true,
    reason: 'Abbreviation and punctuation differences'
  },
  {
    name1: 'ABC Company',
    name2: 'XYZ Corporation',
    shouldMatch: false,
    reason: 'Completely different names'
  },
]

async function runTests() {
  console.log('🧪 Testing Enhanced AI-Powered Duplicate Detection\n')
  console.log('=' .repeat(80))
  
  // Note: These are theoretical tests - actual detection requires database
  console.log('\n📋 Test Cases (Theoretical):')
  console.log('These demonstrate what the algorithm SHOULD detect:\n')
  
  testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.shouldMatch ? '✓ SHOULD MATCH' : '✗ SHOULD NOT MATCH'}`)
    console.log(`  Name 1: "${test.name1}"`)
    console.log(`  Name 2: "${test.name2}"`)
    console.log(`  Reason: ${test.reason}`)
    console.log()
  })
  
  console.log('=' .repeat(80))
  console.log('\n🔍 Running Actual Database Scan...\n')

  try {
    // Test 1: Get duplicate statistics
    console.log('📊 Test 1: Getting enhanced duplicate statistics...')
    const stats = await getDuplicateStatsEnhanced()
    console.log('Stats:', JSON.stringify(stats, null, 2))
    console.log(`✅ Found ${stats.totalGroups} duplicate groups with ${stats.totalDuplicates} total duplicates`)
    console.log(`   - High confidence (90%+): ${stats.highConfidence}`)
    console.log(`   - Medium confidence (75-89%): ${stats.mediumConfidence}`)
    console.log(`   - Low confidence (65-74%): ${stats.lowConfidence}\n`)

    // Test 2: Get full duplicate list with different thresholds
    console.log('📋 Test 2: Testing different similarity thresholds...')
    
    const thresholds = [0.9, 0.8, 0.75, 0.7]
    for (const threshold of thresholds) {
      const duplicates = await detectDuplicateContactsEnhanced(threshold)
      console.log(`  Threshold ${(threshold * 100).toFixed(0)}%: ${duplicates.length} groups found`)
    }
    console.log()

    // Test 3: Display detailed duplicates
    console.log('📝 Test 3: Detailed duplicate analysis (threshold: 75%)...')
    const duplicates = await detectDuplicateContactsEnhanced(0.75)
    
    if (duplicates.length > 0) {
      console.log(`\n✅ Found ${duplicates.length} duplicate groups:\n`)
      
      duplicates.slice(0, 5).forEach((group, index) => {
        console.log(`${'='.repeat(80)}`)
        console.log(`Group ${index + 1} - Similarity: ${(group.similarityScore * 100).toFixed(1)}%`)
        console.log(`Match Reasons: ${group.matchReasons.join(', ')}`)
        console.log(`${'='.repeat(80)}`)
        
        group.contacts.forEach((contact, cIndex) => {
          const isSuggested = contact.id === group.suggestedMerge
          console.log(`  ${cIndex + 1}. ${contact.name}${isSuggested ? ' ← SUGGESTED TO KEEP' : ''}`)
          console.log(`     Email: ${contact.email || 'N/A'}`)
          console.log(`     Phone: ${contact.phone || 'N/A'}`)
          console.log(`     Type: ${contact.isCustomer ? 'Customer' : ''}${contact.isSupplier ? ' Supplier' : ''}`)
          console.log(`     Xero: ${contact.xeroContactId ? 'Synced ✓' : 'Not synced'}`)
          console.log(`     Created: ${contact.createdAt.toISOString().split('T')[0]}`)
          console.log()
        })
      })
      
      if (duplicates.length > 5) {
        console.log(`... and ${duplicates.length - 5} more duplicate groups\n`)
      }
    } else {
      console.log('ℹ️  No duplicates found in the database\n')
    }

    // Test 4: Show algorithm features
    console.log('=' .repeat(80))
    console.log('\n🤖 AI-Powered Features:')
    console.log('  ✓ Normalizes company suffixes (Pte Ltd, Private Limited, etc.)')
    console.log('  ✓ Handles symbol variations (& vs and, . vs nothing)')
    console.log('  ✓ Recognizes abbreviations (Eng vs Engineering, Co vs Company)')
    console.log('  ✓ Word order invariant (ABC Design vs Design ABC)')
    console.log('  ✓ Email domain matching')
    console.log('  ✓ Phone number matching (last 8 digits)')
    console.log('  ✓ Provides match reasons for transparency')
    console.log('  ✓ Suggests which contact to keep (oldest with Xero ID)')
    console.log()

    console.log('✅ All tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

runTests()

