// @ts-nocheck
/**
 * Schema and validation tests
 * Focus on Zod schema validation and edge cases
 */

import assert from "assert"
import {
  mentionSchema,
  commentInputSchema,
  commentUpdateSchema,
  commentDeleteSchema,
} from "../lib/comments"

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

// ============================================================================
// MENTION SCHEMA TESTS
// ============================================================================

test("mentionSchema accepts minimal valid input", () => {
  const input = { id: "user-123" }
  const result = mentionSchema.parse(input)
  assert.strictEqual(result.id, "user-123")
  assert.strictEqual(result.display, undefined)
  assert.strictEqual(result.email, undefined)
})

test("mentionSchema accepts all optional fields", () => {
  const input = {
    id: "user-123",
    display: "John Doe",
    email: "john@example.com",
  }
  const result = mentionSchema.parse(input)
  assert.strictEqual(result.id, "user-123")
  assert.strictEqual(result.display, "John Doe")
  assert.strictEqual(result.email, "john@example.com")
})

test("mentionSchema validates email format strictly", () => {
  const invalidEmails = [
    "plaintext",
    "@example.com",
    "user@",
    "user..name@example.com",
    "user @example.com",
    "user@example",
  ]

  invalidEmails.forEach((email) => {
    assert.throws(
      () => mentionSchema.parse({ id: "user-1", email }),
      Error,
      `Should reject: ${email}`
    )
  })
})

test("mentionSchema accepts various valid email formats", () => {
  const validEmails = [
    "user@example.com",
    "user.name@example.com",
    "user+tag@example.com",
    "user_name@example.co.uk",
    "123@example.com",
    "u@e.co",
  ]

  validEmails.forEach((email) => {
    assert.doesNotThrow(
      () => mentionSchema.parse({ id: "user-1", email }),
      `Should accept: ${email}`
    )
  })
})

test("mentionSchema requires id to be string", () => {
  assert.throws(() => mentionSchema.parse({ id: 123 }), Error)
  assert.throws(() => mentionSchema.parse({ id: null }), Error)
  assert.throws(() => mentionSchema.parse({ id: undefined }), Error)
  assert.throws(() => mentionSchema.parse({}), Error)
})

test("mentionSchema handles empty strings appropriately", () => {
  // Empty ID should fail
  assert.throws(() => mentionSchema.parse({ id: "" }), Error)

  // Empty display is allowed (optional field)
  assert.doesNotThrow(() =>
    mentionSchema.parse({ id: "user-1", display: "" })
  )
})

// ============================================================================
// COMMENT INPUT SCHEMA TESTS
// ============================================================================

test("commentInputSchema trims leading whitespace", () => {
  const input = { content: "   Content" }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content, "Content")
})

test("commentInputSchema trims trailing whitespace", () => {
  const input = { content: "Content   " }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content, "Content")
})

test("commentInputSchema trims both sides", () => {
  const input = { content: "  Content  " }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content, "Content")
})

test("commentInputSchema preserves internal whitespace", () => {
  const input = { content: "Content  with   spaces" }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content, "Content  with   spaces")
})

test("commentInputSchema rejects whitespace-only content", () => {
  const whitespaceInputs = [
    { content: "   " },
    { content: "\n\n\n" },
    { content: "\t\t\t" },
    { content: " \n\t " },
  ]

  whitespaceInputs.forEach((input, index) => {
    assert.throws(
      () => commentInputSchema.parse(input),
      Error,
      `Should reject whitespace-only input ${index + 1}`
    )
  })
})

test("commentInputSchema requires content to have minimum length after trimming", () => {
  assert.throws(() => commentInputSchema.parse({ content: "" }), Error)
  assert.throws(() => commentInputSchema.parse({ content: " " }), Error)
  assert.doesNotThrow(() => commentInputSchema.parse({ content: "a" }))
})

test("commentInputSchema provides default empty array for mentions when omitted", () => {
  const input = { content: "Hello" }
  const result = commentInputSchema.parse(input)
  assert.ok(Array.isArray(result.mentions))
  assert.strictEqual(result.mentions.length, 0)
})

test("commentInputSchema provides default empty array for mentions when explicitly undefined", () => {
  const input = { content: "Hello", mentions: undefined }
  const result = commentInputSchema.parse(input)
  assert.ok(Array.isArray(result.mentions))
  assert.strictEqual(result.mentions.length, 0)
})

test("commentInputSchema validates mention array items", () => {
  const input = {
    content: "Hello",
    mentions: [
      { id: "valid-id", display: "Valid User" },
      { id: "another-id", email: "valid@email.com" },
    ],
  }
  assert.doesNotThrow(() => commentInputSchema.parse(input))
})

test("commentInputSchema rejects invalid mention in array", () => {
  const input = {
    content: "Hello",
    mentions: [
      { id: "valid-id" },
      { display: "No ID" }, // Missing required id
    ],
  }
  assert.throws(() => commentInputSchema.parse(input), Error)
})

test("commentInputSchema handles very long content", () => {
  const longContent = "A".repeat(100000)
  const input = { content: longContent }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content.length, 100000)
})

test("commentInputSchema handles unicode characters", () => {
  const inputs = [
    { content: "Hello 世界" },
    { content: "Emoji 🚀 test" },
    { content: "Ñoño José" },
  ]

  inputs.forEach((input) => {
    assert.doesNotThrow(() => commentInputSchema.parse(input))
    const result = commentInputSchema.parse(input)
    assert.strictEqual(result.content, input.content.trim())
  })
})

test("commentInputSchema handles newlines in content", () => {
  const input = { content: "Line 1\nLine 2\nLine 3" }
  const result = commentInputSchema.parse(input)
  assert.strictEqual(result.content, "Line 1\nLine 2\nLine 3")
})

// ============================================================================
// COMMENT UPDATE SCHEMA TESTS
// ============================================================================

test("commentUpdateSchema requires both commentId and content", () => {
  assert.throws(() => commentUpdateSchema.parse({ content: "Content" }), Error)
  assert.throws(() => commentUpdateSchema.parse({ commentId: "id-123" }), Error)
  assert.doesNotThrow(() =>
    commentUpdateSchema.parse({ commentId: "id-123", content: "Content" })
  )
})

test("commentUpdateSchema trims content like input schema", () => {
  const input = { commentId: "id-123", content: "  Trimmed  " }
  const result = commentUpdateSchema.parse(input)
  assert.strictEqual(result.content, "Trimmed")
})

test("commentUpdateSchema validates commentId as string", () => {
  assert.throws(() =>
    commentUpdateSchema.parse({ commentId: 123, content: "Content" })
  , Error)
  assert.throws(() =>
    commentUpdateSchema.parse({ commentId: null, content: "Content" })
  , Error)
})

test("commentUpdateSchema handles mentions array", () => {
  const input = {
    commentId: "id-123",
    content: "Updated",
    mentions: [{ id: "user-1", display: "User" }],
  }
  const result = commentUpdateSchema.parse(input)
  assert.strictEqual(result.mentions.length, 1)
  assert.strictEqual(result.mentions[0].id, "user-1")
})

test("commentUpdateSchema provides default empty mentions array", () => {
  const input = { commentId: "id-123", content: "Updated" }
  const result = commentUpdateSchema.parse(input)
  assert.ok(Array.isArray(result.mentions))
  assert.strictEqual(result.mentions.length, 0)
})

test("commentUpdateSchema rejects empty content after trimming", () => {
  assert.throws(() =>
    commentUpdateSchema.parse({ commentId: "id-123", content: "   " })
  , Error)
})

test("commentUpdateSchema allows updating to single character", () => {
  const input = { commentId: "id-123", content: "X" }
  assert.doesNotThrow(() => commentUpdateSchema.parse(input))
})

// ============================================================================
// COMMENT DELETE SCHEMA TESTS
// ============================================================================

test("commentDeleteSchema requires commentId", () => {
  assert.throws(() => commentDeleteSchema.parse({}), Error)
  assert.throws(() => commentDeleteSchema.parse({ commentId: null }), Error)
  assert.throws(() => commentDeleteSchema.parse({ commentId: undefined }), Error)
})

test("commentDeleteSchema accepts valid commentId", () => {
  const input = { commentId: "comment-456" }
  const result = commentDeleteSchema.parse(input)
  assert.strictEqual(result.commentId, "comment-456")
})

test("commentDeleteSchema only requires commentId", () => {
  // Extra fields should be ignored or allowed
  const input = { commentId: "comment-456", extraField: "ignored" }
  const result = commentDeleteSchema.parse(input)
  assert.strictEqual(result.commentId, "comment-456")
})

test("commentDeleteSchema validates commentId type", () => {
  assert.throws(() => commentDeleteSchema.parse({ commentId: 123 }), Error)
  assert.throws(() => commentDeleteSchema.parse({ commentId: true }), Error)
  assert.throws(() => commentDeleteSchema.parse({ commentId: [] }), Error)
})

test("commentDeleteSchema accepts any non-empty string as commentId", () => {
  const validIds = [
    "simple-id",
    "uuid-v4-123-456",
    "UPPERCASE-ID",
    "123456",
    "id_with_underscore",
    "id-with-dashes",
  ]

  validIds.forEach((id) => {
    assert.doesNotThrow(() => commentDeleteSchema.parse({ commentId: id }))
  })
})

test("commentDeleteSchema rejects empty string commentId", () => {
  assert.throws(() => commentDeleteSchema.parse({ commentId: "" }), Error)
})

// ============================================================================
// COMBINED SCHEMA INTERACTION TESTS
// ============================================================================

test("schemas handle same mention object consistently", () => {
  const mention = { id: "user-1", display: "User", email: "user@example.com" }

  // Should work in input schema
  const input = commentInputSchema.parse({ content: "Test", mentions: [mention] })
  assert.strictEqual(input.mentions[0].id, "user-1")

  // Should work in update schema
  const update = commentUpdateSchema.parse({
    commentId: "c1",
    content: "Test",
    mentions: [mention],
  })
  assert.strictEqual(update.mentions[0].id, "user-1")
})

test("all schemas handle extra properties appropriately", () => {
  // Zod strips extra properties by default in strict mode
  const mentionResult = mentionSchema.parse({
    id: "user-1",
    extraProp: "ignored",
  })
  assert.strictEqual(mentionResult.id, "user-1")

  const inputResult = commentInputSchema.parse({
    content: "Test",
    extraProp: "ignored",
  })
  assert.strictEqual(inputResult.content, "Test")

  const updateResult = commentUpdateSchema.parse({
    commentId: "c1",
    content: "Test",
    extraProp: "ignored",
  })
  assert.strictEqual(updateResult.commentId, "c1")

  const deleteResult = commentDeleteSchema.parse({
    commentId: "c1",
    extraProp: "ignored",
  })
  assert.strictEqual(deleteResult.commentId, "c1")
})

// Run all tests
tests.forEach(({ name, run }) => {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  Error: ${error.message}`)
    throw error
  }
})

console.log(`\n✅ All ${tests.length} schema validation tests passed!`)