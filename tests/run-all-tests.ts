#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Master test runner for all comment system tests
 * Runs all test suites and reports combined results
 */

import { execSync } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

interface TestSuite {
  name: string
  file: string
  description: string
}

const testSuites: TestSuite[] = [
  {
    name: "Comments Core",
    file: "tests/comments.test.tsx",
    description: "Core functionality, schemas, and component rendering tests",
  },
  {
    name: "API Handlers",
    file: "tests/api-handlers.test.ts",
    description: "API handler business logic and integration tests",
  },
  {
    name: "Schema Validation",
    file: "tests/schema-validation.test.ts",
    description: "Zod schema validation and edge case tests",
  },
]

console.log("=" .repeat(70))
console.log("  AMPERE BUSINESS MANAGEMENT - COMMENT SYSTEM TEST SUITE")
console.log("=" .repeat(70))
console.log()

let totalPassed = 0
let totalFailed = 0
const results: Array<{ suite: string; status: "PASS" | "FAIL"; error?: string }> = []

for (const suite of testSuites) {
  const filePath = resolve(process.cwd(), suite.file)
  
  if (!existsSync(filePath)) {
    console.log(`⚠️  ${suite.name}: Test file not found - ${suite.file}`)
    results.push({ suite: suite.name, status: "FAIL", error: "File not found" })
    totalFailed++
    continue
  }

  console.log(`\n📋 Running: ${suite.name}`)
  console.log(`   ${suite.description}`)
  console.log(`   File: ${suite.file}`)
  console.log("-".repeat(70))

  try {
    execSync(`tsx ${suite.file}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    })
    console.log("-".repeat(70))
    console.log(`✅ ${suite.name}: PASSED`)
    results.push({ suite: suite.name, status: "PASS" })
    totalPassed++
  } catch (error) {
    console.log("-".repeat(70))
    console.log(`❌ ${suite.name}: FAILED`)
    results.push({ suite: suite.name, status: "FAIL", error: error.message })
    totalFailed++
  }
}

// Print summary
console.log()
console.log("=" .repeat(70))
console.log("  TEST SUMMARY")
console.log("=" .repeat(70))
console.log()

results.forEach(({ suite, status, error }) => {
  const icon = status === "PASS" ? "✅" : "❌"
  console.log(`${icon} ${suite}: ${status}`)
  if (error) {
    console.log(`   Error: ${error}`)
  }
})

console.log()
console.log("-".repeat(70))
console.log(`Total Suites: ${testSuites.length}`)
console.log(`Passed: ${totalPassed}`)
console.log(`Failed: ${totalFailed}`)
console.log("=" .repeat(70))

if (totalFailed > 0) {
  console.log()
  console.log("❌ Some tests failed. Please review the output above.")
  process.exit(1)
} else {
  console.log()
  console.log("✅ All test suites passed!")
  process.exit(0)
}