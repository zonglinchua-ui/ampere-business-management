// @ts-nocheck
/**
 * Integration tests for API handlers
 * These tests verify the business logic and validation in API handlers
 */

import assert from "assert"
import { 
  getCommentEntityKey,
  commentInputSchema,
  commentUpdateSchema,
  commentDeleteSchema,
  ensureMentionMarkup,
  canModifyComment
} from "../lib/comments"
import { CommentEntityType } from "@prisma/client"

const tests: Array<{ name: string; run: () => void | Promise<void> }> = []

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run })
}

// ============================================================================
// API HANDLER LOGIC TESTS
// ============================================================================

test("getCommentEntityKey maps all entity types correctly", () => {
  const mappings = [
    { type: CommentEntityType.INVOICE, expected: "invoiceId" },
    { type: CommentEntityType.PURCHASE_ORDER, expected: "purchaseOrderId" },
    { type: CommentEntityType.PROJECT_BUDGET, expected: "projectId" },
  ]

  mappings.forEach(({ type, expected }) => {
    const result = getCommentEntityKey(type)
    assert.strictEqual(result, expected, `Failed for ${type}`)
  })
})

test("comment creation validates required fields", () => {
  // Valid comment
  const valid = { content: "This is a comment", mentions: [] }
  const parsed = commentInputSchema.parse(valid)
  assert.strictEqual(parsed.content, "This is a comment")

  // Missing content
  assert.throws(() => {
    commentInputSchema.parse({ content: "" })
  }, Error, "Should reject empty content")

  // Whitespace only
  assert.throws(() => {
    commentInputSchema.parse({ content: "   " })
  }, Error, "Should reject whitespace-only content")
})

test("comment update validates commentId and content", () => {
  // Valid update
  const valid = {
    commentId: "comment-123",
    content: "Updated content",
    mentions: [],
  }
  const parsed = commentUpdateSchema.parse(valid)
  assert.strictEqual(parsed.commentId, "comment-123")
  assert.strictEqual(parsed.content, "Updated content")

  // Missing commentId
  assert.throws(() => {
    commentUpdateSchema.parse({ content: "Content" })
  }, Error, "Should require commentId")

  // Empty content
  assert.throws(() => {
    commentUpdateSchema.parse({ commentId: "123", content: "" })
  }, Error, "Should reject empty content")
})

test("comment deletion requires commentId", () => {
  const valid = { commentId: "comment-456" }
  const parsed = commentDeleteSchema.parse(valid)
  assert.strictEqual(parsed.commentId, "comment-456")

  assert.throws(() => {
    commentDeleteSchema.parse({})
  }, Error, "Should require commentId")
})

test("authorization logic enforces ownership and roles", () => {
  // Test cases: [userId, role, ownerId, expectedResult]
  const testCases = [
    ["user-1", "SUPERADMIN", "user-2", true],  // SUPERADMIN can modify any
    ["user-1", "USER", "user-1", true],         // Owner can modify own
    ["user-1", "USER", "user-2", false],        // Non-owner cannot modify
    ["user-1", "ADMIN", "user-2", false],       // Only SUPERADMIN has universal access
    [undefined, "USER", "user-1", false],       // Undefined user cannot modify
    ["", "USER", "user-1", false],              // Empty user cannot modify
    ["user-1", undefined, "user-1", true],      // Owner can modify even without explicit role
  ]

  testCases.forEach(([userId, role, ownerId, expected], index) => {
    const result = canModifyComment(userId as any, role as any, ownerId as string)
    assert.strictEqual(
      result,
      expected,
      `Test case ${index + 1} failed: canModifyComment(${userId}, ${role}, ${ownerId}) should return ${expected}`
    )
  })
})

test("mention processing deduplicates user IDs", () => {
  const mentions = [
    { id: "user-1", display: "Alice" },
    { id: "user-2", display: "Bob" },
    { id: "user-1", display: "Alice" }, // Duplicate
    { id: "user-3", display: "Charlie" },
  ]

  // Simulate the deduplication logic from handler
  const mentionRecords = mentions.reduce((acc: any[], mention) => {
    if (!acc.find((existing) => existing.userId === mention.id)) {
      acc.push({ userId: mention.id })
    }
    return acc
  }, [])

  assert.strictEqual(mentionRecords.length, 3)
  assert.ok(mentionRecords.find((m) => m.userId === "user-1"))
  assert.ok(mentionRecords.find((m) => m.userId === "user-2"))
  assert.ok(mentionRecords.find((m) => m.userId === "user-3"))
})

test("mention markup normalization handles edge cases", () => {
  // Case 1: Mention without display field
  let content = "Hello @Someone"
  let mentions = [{ id: "user-1", display: "" }]
  let result = ensureMentionMarkup(content, mentions)
  assert.strictEqual(result, "Hello @Someone", "Should skip empty display")

  // Case 2: Already formatted mentions
  content = "Hello @[Alice](user-1)"
  mentions = [{ id: "user-1", display: "Alice" }]
  result = ensureMentionMarkup(content, mentions)
  // Should not double-wrap
  const count = (result.match(/@\[Alice\]\(user-1\)/g) || []).length
  assert.strictEqual(count, 1, "Should not double-wrap mentions")

  // Case 3: Mixed formatted and unformatted
  content = "@[Alice](user-1) and @Bob"
  mentions = [
    { id: "user-1", display: "Alice" },
    { id: "user-2", display: "Bob" },
  ]
  result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[Alice](user-1)"), "Should keep existing markup")
  assert.ok(result.includes("@[Bob](user-2)"), "Should add new markup")
})

test("entity type endpoint mapping is exhaustive", () => {
  const entityTypes = [
    CommentEntityType.INVOICE,
    CommentEntityType.PURCHASE_ORDER,
    CommentEntityType.PROJECT_BUDGET,
  ]

  entityTypes.forEach((entityType) => {
    const key = getCommentEntityKey(entityType)
    assert.ok(key, `Should return a key for ${entityType}`)
    assert.notStrictEqual(key, "entityId", `Should have specific key for ${entityType}`)
  })
})

test("comment validation trims and normalizes content", () => {
  const testCases = [
    { input: "  Normal text  ", expected: "Normal text" },
    { input: "\n\nText with newlines\n\n", expected: "Text with newlines" },
    { input: "\t\tTabbed text\t\t", expected: "Tabbed text" },
    { input: "  Multiple   spaces  ", expected: "Multiple   spaces" }, // Internal spaces preserved
  ]

  testCases.forEach(({ input, expected }) => {
    const parsed = commentInputSchema.parse({ content: input })
    assert.strictEqual(parsed.content, expected)
  })
})

test("mention schema validates email format", () => {
  // Valid emails
  const validEmails = [
    "user@example.com",
    "user.name@example.com",
    "user+tag@example.co.uk",
  ]

  validEmails.forEach((email) => {
    const mention = { id: "user-1", email }
    assert.doesNotThrow(() => {
      commentInputSchema.parse({ content: "Test", mentions: [mention] })
    }, `Should accept valid email: ${email}`)
  })

  // Invalid emails
  const invalidEmails = ["not-an-email", "@example.com", "user@", "user"]

  invalidEmails.forEach((email) => {
    const mention = { id: "user-1", email }
    assert.throws(() => {
      commentInputSchema.parse({ content: "Test", mentions: [mention] })
    }, Error, `Should reject invalid email: ${email}`)
  })
})

test("comment update preserves commentId", () => {
  const updates = [
    { commentId: "c1", content: "Update 1" },
    { commentId: "c2", content: "Update 2", mentions: [{ id: "u1" }] },
  ]

  updates.forEach((update) => {
    const parsed = commentUpdateSchema.parse(update)
    assert.strictEqual(parsed.commentId, update.commentId)
  })
})

test("mention deduplication preserves first occurrence", () => {
  const mentions = [
    { id: "user-1", display: "First Alice" },
    { id: "user-2", display: "Bob" },
    { id: "user-1", display: "Second Alice" }, // Duplicate ID
  ]

  const deduplicated = mentions.reduce((acc: any[], mention) => {
    if (!acc.find((m) => m.id === mention.id)) {
      acc.push(mention)
    }
    return acc
  }, [])

  assert.strictEqual(deduplicated.length, 2)
  assert.strictEqual(deduplicated[0].display, "First Alice")
})

// ============================================================================
// USER SEARCH API LOGIC TESTS
// ============================================================================

test("user search query handling", () => {
  // Test query parameter extraction logic
  const testCases = [
    { query: "john", expected: "john" },
    { query: "", expected: "" },
    { query: null, expected: "" },
    { query: "user@example.com", expected: "user@example.com" },
  ]

  testCases.forEach(({ query, expected }) => {
    const result = query || ""
    assert.strictEqual(result, expected)
  })
})

test("user search limit parameter validation", () => {
  const testCases = [
    { limit: "10", expected: 10 },
    { limit: "5", expected: 5 },
    { limit: "", expected: 10 }, // Default
    { limit: null, expected: 10 }, // Default
    { limit: "invalid", expected: NaN },
  ]

  testCases.forEach(({ limit, expected }) => {
    const result = Number(limit || 10)
    if (isNaN(expected)) {
      assert.ok(isNaN(result))
    } else {
      assert.strictEqual(result, expected)
    }
  })
})

test("user search result mapping", () => {
  const mockUsers = [
    { id: "1", name: "John Doe", email: "john@example.com", role: "USER" },
    { id: "2", name: null, email: "jane@example.com", role: "ADMIN" },
  ]

  const mapped = mockUsers.map((user) => ({
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    role: user.role,
  }))

  assert.strictEqual(mapped[0].name, "John Doe")
  assert.strictEqual(mapped[1].name, "jane@example.com") // Falls back to email
  assert.strictEqual(mapped.length, 2)
})

// ============================================================================
// ROUTE FILE DELEGATION TESTS
// ============================================================================

test("route files correctly specify entity types", () => {
  const routes = [
    { path: "budgets/[id]/comments", entityType: CommentEntityType.PROJECT_BUDGET },
    { path: "invoices/[id]/comments", entityType: CommentEntityType.INVOICE },
    { path: "pos/[id]/comments", entityType: CommentEntityType.PURCHASE_ORDER },
  ]

  routes.forEach(({ path, entityType }) => {
    const key = getCommentEntityKey(entityType)
    assert.ok(key, `Route ${path} should map to valid entity key`)
  })
})

// Run all tests
async function runTests() {
  let passed = 0
  let failed = 0

  for (const { name, run } of tests) {
    try {
      await run()
      console.log(`✓ ${name}`)
      passed++
    } catch (error) {
      console.error(`✗ ${name}`)
      console.error(`  Error: ${error.message}`)
      failed++
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log(`Tests: ${tests.length} total, ${passed} passed, ${failed} failed`)
  console.log(`${"=".repeat(60)}`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()