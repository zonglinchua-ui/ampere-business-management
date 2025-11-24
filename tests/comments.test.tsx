// @ts-nocheck
import assert from "assert"
import React from "react"
import { renderToString } from "react-dom/server"
import { CommentThread } from "../components/comments/CommentThread"
import { 
  canModifyComment, 
  commentInputSchema, 
  commentUpdateSchema,
  commentDeleteSchema,
  extractMentions,
  ensureMentionMarkup,
  CommentEntityTypeEnum,
  getCommentEntityKey,
  mentionSchema,
  mentionTokenRegex
} from "../lib/comments"

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

// ============================================================================
// EXISTING TESTS (kept for compatibility)
// ============================================================================

test("parses mention tokens and strips markup", () => {
  const sample = "Hello @[Jane Doe](user-1) and @[John](user-2)!"
  const result = extractMentions(sample)
  assert.strictEqual(result.mentions.length, 2)
  assert.strictEqual(result.mentions[0].id, "user-1")
  assert.strictEqual(result.plainText.includes("@Jane Doe"), true)
})

test("validates comment creation payload", () => {
  const parsed = commentInputSchema.parse({
    content: "  Trim me  ",
    mentions: [{ id: "user-123" }],
  })
  assert.strictEqual(parsed.content, "Trim me")
  assert.strictEqual(parsed.mentions?.[0]?.id, "user-123")
})

test("enforces comment ownership rules", () => {
  assert.strictEqual(canModifyComment("owner", "USER", "owner"), true)
  assert.strictEqual(canModifyComment("someone", "SUPERADMIN", "owner"), true)
  assert.strictEqual(canModifyComment("viewer", "USER", "owner"), false)
})

test("renders comment thread with initial comments", () => {
  const markup = renderToString(
    <CommentThread
      entityId="demo-id"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Hello @team",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "Test User", email: "test@example.com", role: "SUPERADMIN" },
          mentions: [{ id: "u2", name: "Another" }],
        },
      ]}
      fetchOnMount={false}
    />
  )

  assert.ok(markup.includes("Test User"))
  assert.ok(markup.includes("Comments"))
})

// ============================================================================
// NEW COMPREHENSIVE TESTS - lib/comments.ts
// ============================================================================

// Test: mentionTokenRegex
test("mentionTokenRegex matches valid mention tokens", () => {
  const text = "Hello @[User One](id-1) and @[User Two](id-2)"
  const matches = Array.from(text.matchAll(mentionTokenRegex))
  assert.strictEqual(matches.length, 2)
  assert.strictEqual(matches[0][1], "User One")
  assert.strictEqual(matches[0][2], "id-1")
  assert.strictEqual(matches[1][1], "User Two")
  assert.strictEqual(matches[1][2], "id-2")
})

test("mentionTokenRegex ignores malformed mention tokens", () => {
  const text = "@[NoClosingBracket(id-1) @(NoSquareBrackets) @[](empty)"
  const matches = Array.from(text.matchAll(mentionTokenRegex))
  assert.strictEqual(matches.length, 1) // Only @[](empty) matches
})

test("mentionTokenRegex handles special characters in display names", () => {
  const text = "@[User-Name_123](id-1) @[Name with spaces](id-2)"
  const matches = Array.from(text.matchAll(mentionTokenRegex))
  assert.strictEqual(matches.length, 2)
  assert.strictEqual(matches[0][1], "User-Name_123")
  assert.strictEqual(matches[1][1], "Name with spaces")
})

// Test: mentionSchema
test("mentionSchema validates correct mention object", () => {
  const validMention = { id: "user-123", display: "John Doe", email: "john@example.com" }
  const parsed = mentionSchema.parse(validMention)
  assert.strictEqual(parsed.id, "user-123")
  assert.strictEqual(parsed.display, "John Doe")
  assert.strictEqual(parsed.email, "john@example.com")
})

test("mentionSchema allows optional display and email", () => {
  const minimalMention = { id: "user-123" }
  const parsed = mentionSchema.parse(minimalMention)
  assert.strictEqual(parsed.id, "user-123")
  assert.strictEqual(parsed.display, undefined)
  assert.strictEqual(parsed.email, undefined)
})

test("mentionSchema rejects invalid email format", () => {
  const invalidMention = { id: "user-123", email: "not-an-email" }
  assert.throws(() => mentionSchema.parse(invalidMention), Error)
})

test("mentionSchema requires id field", () => {
  const noId = { display: "John Doe" }
  assert.throws(() => mentionSchema.parse(noId), Error)
})

// Test: commentInputSchema
test("commentInputSchema trims whitespace from content", () => {
  const input = { content: "  Hello World  ", mentions: [] }
  const parsed = commentInputSchema.parse(input)
  assert.strictEqual(parsed.content, "Hello World")
})

test("commentInputSchema rejects empty content", () => {
  const input = { content: "   ", mentions: [] }
  assert.throws(() => commentInputSchema.parse(input), Error)
})

test("commentInputSchema provides default empty array for mentions", () => {
  const input = { content: "Hello" }
  const parsed = commentInputSchema.parse(input)
  assert.ok(Array.isArray(parsed.mentions))
  assert.strictEqual(parsed.mentions.length, 0)
})

test("commentInputSchema validates mention array", () => {
  const input = {
    content: "Hello @user",
    mentions: [
      { id: "user-1", display: "User One" },
      { id: "user-2", display: "User Two", email: "user2@example.com" },
    ],
  }
  const parsed = commentInputSchema.parse(input)
  assert.strictEqual(parsed.mentions.length, 2)
  assert.strictEqual(parsed.mentions[0].id, "user-1")
  assert.strictEqual(parsed.mentions[1].email, "user2@example.com")
})

// Test: commentUpdateSchema
test("commentUpdateSchema requires commentId", () => {
  const input = { content: "Updated content", mentions: [] }
  assert.throws(() => commentUpdateSchema.parse(input), Error)
})

test("commentUpdateSchema validates complete update payload", () => {
  const input = {
    commentId: "comment-123",
    content: "  Updated content  ",
    mentions: [{ id: "user-1" }],
  }
  const parsed = commentUpdateSchema.parse(input)
  assert.strictEqual(parsed.commentId, "comment-123")
  assert.strictEqual(parsed.content, "Updated content")
  assert.strictEqual(parsed.mentions.length, 1)
})

test("commentUpdateSchema rejects empty content on update", () => {
  const input = { commentId: "comment-123", content: "" }
  assert.throws(() => commentUpdateSchema.parse(input), Error)
})

// Test: commentDeleteSchema
test("commentDeleteSchema requires commentId", () => {
  const input = {}
  assert.throws(() => commentDeleteSchema.parse(input), Error)
})

test("commentDeleteSchema validates delete payload", () => {
  const input = { commentId: "comment-456" }
  const parsed = commentDeleteSchema.parse(input)
  assert.strictEqual(parsed.commentId, "comment-456")
})

// Test: extractMentions
test("extractMentions handles empty string", () => {
  const result = extractMentions("")
  assert.strictEqual(result.mentions.length, 0)
  assert.strictEqual(result.plainText, "")
})

test("extractMentions handles text without mentions", () => {
  const text = "This is a regular comment"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions.length, 0)
  assert.strictEqual(result.plainText, "This is a regular comment")
})

test("extractMentions extracts multiple mentions", () => {
  const text = "Hello @[Alice](user-1), meet @[Bob](user-2) and @[Charlie](user-3)!"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions.length, 3)
  assert.strictEqual(result.mentions[0].display, "Alice")
  assert.strictEqual(result.mentions[1].id, "user-2")
  assert.strictEqual(result.mentions[2].display, "Charlie")
  assert.ok(result.plainText.includes("@Alice"))
  assert.ok(result.plainText.includes("@Bob"))
  assert.ok(result.plainText.includes("@Charlie"))
})

test("extractMentions trims resulting plainText", () => {
  const text = "  @[User](user-1) says hello  "
  const result = extractMentions(text)
  assert.strictEqual(result.plainText, "@User says hello")
})

test("extractMentions handles mentions at start and end", () => {
  const text = "@[Start](id-1) middle text @[End](id-2)"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions.length, 2)
  assert.strictEqual(result.mentions[0].display, "Start")
  assert.strictEqual(result.mentions[1].display, "End")
})

test("extractMentions preserves order of mentions", () => {
  const text = "@[Third](id-3) @[First](id-1) @[Second](id-2)"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions[0].id, "id-3")
  assert.strictEqual(result.mentions[1].id, "id-1")
  assert.strictEqual(result.mentions[2].id, "id-2")
})

// Test: ensureMentionMarkup
test("ensureMentionMarkup converts plain mentions to markup", () => {
  const content = "Hello @John, how are you?"
  const mentions = [{ id: "user-1", display: "John" }]
  const result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[John](user-1)"))
  assert.ok(!result.includes("@John,"))
})

test("ensureMentionMarkup handles multiple mentions", () => {
  const content = "Meeting with @Alice and @Bob tomorrow"
  const mentions = [
    { id: "user-1", display: "Alice" },
    { id: "user-2", display: "Bob" },
  ]
  const result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[Alice](user-1)"))
  assert.ok(result.includes("@[Bob](user-2)"))
})

test("ensureMentionMarkup skips mentions without display", () => {
  const content = "Hello @Unknown"
  const mentions = [{ id: "user-1", display: "" }]
  const result = ensureMentionMarkup(content, mentions)
  assert.strictEqual(result, "Hello @Unknown")
})

test("ensureMentionMarkup does not double-wrap existing markup", () => {
  const content = "Hello @[Alice](user-1) and @Bob"
  const mentions = [
    { id: "user-1", display: "Alice" },
    { id: "user-2", display: "Bob" },
  ]
  const result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[Alice](user-1)")) // Already wrapped, should stay the same
  assert.ok(result.includes("@[Bob](user-2)")) // New wrapping
  // Count occurrences of Alice markup - should only be 1
  const aliceMatches = (result.match(/@\[Alice\]\(user-1\)/g) || []).length
  assert.strictEqual(aliceMatches, 1)
})

test("ensureMentionMarkup handles mentions with special characters", () => {
  const content = "Contact @Jane-Doe about this"
  const mentions = [{ id: "user-1", display: "Jane-Doe" }]
  const result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[Jane-Doe](user-1)"))
})

test("ensureMentionMarkup preserves content when no mentions match", () => {
  const content = "No mentions here"
  const mentions = [{ id: "user-1", display: "Alice" }]
  const result = ensureMentionMarkup(content, mentions)
  assert.strictEqual(result, "No mentions here")
})

test("ensureMentionMarkup replaces all occurrences of same mention", () => {
  const content = "@John said hi. Then @John left. @John is busy."
  const mentions = [{ id: "user-1", display: "John" }]
  const result = ensureMentionMarkup(content, mentions)
  const johnMatches = (result.match(/@\[John\]\(user-1\)/g) || []).length
  assert.strictEqual(johnMatches, 3)
})

// Test: canModifyComment
test("canModifyComment returns false when userId is undefined", () => {
  const result = canModifyComment(undefined, "USER", "owner-123")
  assert.strictEqual(result, false)
})

test("canModifyComment allows SUPERADMIN to modify any comment", () => {
  const result = canModifyComment("admin-1", "SUPERADMIN", "owner-123")
  assert.strictEqual(result, true)
})

test("canModifyComment allows owner to modify their own comment", () => {
  const result = canModifyComment("owner-123", "USER", "owner-123")
  assert.strictEqual(result, true)
})

test("canModifyComment denies non-owner non-admin", () => {
  const result = canModifyComment("user-456", "USER", "owner-123")
  assert.strictEqual(result, false)
})

test("canModifyComment handles different admin-like roles", () => {
  // Only SUPERADMIN should have universal access
  assert.strictEqual(canModifyComment("admin-1", "SUPERADMIN", "owner-123"), true)
  assert.strictEqual(canModifyComment("admin-2", "ADMIN", "owner-123"), false)
  assert.strictEqual(canModifyComment("pm-1", "PROJECT_MANAGER", "owner-123"), false)
})

test("canModifyComment handles undefined role", () => {
  const result = canModifyComment("user-1", undefined, "owner-123")
  assert.strictEqual(result, false)
})

test("canModifyComment handles empty string userId", () => {
  const result = canModifyComment("", "USER", "owner-123")
  assert.strictEqual(result, false)
})

// Test: getCommentEntityKey
test("getCommentEntityKey returns correct key for INVOICE", () => {
  const key = getCommentEntityKey(CommentEntityTypeEnum.INVOICE)
  assert.strictEqual(key, "invoiceId")
})

test("getCommentEntityKey returns correct key for PURCHASE_ORDER", () => {
  const key = getCommentEntityKey(CommentEntityTypeEnum.PURCHASE_ORDER)
  assert.strictEqual(key, "purchaseOrderId")
})

test("getCommentEntityKey returns correct key for PROJECT_BUDGET", () => {
  const key = getCommentEntityKey(CommentEntityTypeEnum.PROJECT_BUDGET)
  assert.strictEqual(key, "projectId")
})

test("getCommentEntityKey returns correct key for TAKEOFF_SHEET", () => {
  const key = getCommentEntityKey("TAKEOFF_SHEET" as any)
  assert.strictEqual(key, "planSheetId")
})

test("getCommentEntityKey returns correct key for TAKEOFF_MEASUREMENT", () => {
  const key = getCommentEntityKey("TAKEOFF_MEASUREMENT" as any)
  assert.strictEqual(key, "measurementId")
})

test("getCommentEntityKey returns default for unknown entity type", () => {
  // Cast to bypass TypeScript checking for this edge case test
  const key = getCommentEntityKey("UNKNOWN_TYPE" as any)
  assert.strictEqual(key, "entityId")
})

// ============================================================================
// COMPONENT TESTS - CommentThread
// ============================================================================

test("CommentThread renders with INVOICE entity type", () => {
  const markup = renderToString(
    <CommentThread
      entityId="invoice-123"
      entityType="INVOICE"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Comments"))
  assert.ok(markup.includes("Leave a comment"))
})

test("CommentThread renders with PURCHASE_ORDER entity type", () => {
  const markup = renderToString(
    <CommentThread
      entityId="po-456"
      entityType="PURCHASE_ORDER"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Comments"))
})

test("CommentThread renders with PROJECT_BUDGET entity type", () => {
  const markup = renderToString(
    <CommentThread
      entityId="budget-789"
      entityType="PROJECT_BUDGET"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Comments"))
})

test("CommentThread renders with TAKEOFF entities", () => {
  const sheetMarkup = renderToString(
    <CommentThread
      entityId="sheet-123"
      entityType="TAKEOFF_SHEET"
      initialComments={[]}
      fetchOnMount={false}
    />
  )

  const measurementMarkup = renderToString(
    <CommentThread
      entityId="measurement-123"
      entityType="TAKEOFF_MEASUREMENT"
      initialComments={[]}
      fetchOnMount={false}
    />
  )

  assert.ok(sheetMarkup.includes("Comments"))
  assert.ok(measurementMarkup.includes("Comments"))
})

test("CommentThread displays empty state when no comments", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("No comments yet") || markup.includes("Start the conversation"))
})

test("CommentThread displays initial comments", () => {
  const initialComments = [
    {
      id: "comment-1",
      content: "First comment",
      createdAt: new Date().toISOString(),
      user: { id: "user-1", name: "Alice", email: "alice@example.com", role: "USER" },
    },
    {
      id: "comment-2",
      content: "Second comment",
      createdAt: new Date().toISOString(),
      user: { id: "user-2", name: "Bob", email: "bob@example.com", role: "USER" },
    },
  ]
  
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={initialComments}
      fetchOnMount={false}
    />
  )
  
  assert.ok(markup.includes("First comment"))
  assert.ok(markup.includes("Second comment"))
  assert.ok(markup.includes("Alice"))
  assert.ok(markup.includes("Bob"))
})

test("CommentThread renders user initials from name", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Test",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "John Doe", email: "john@example.com" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("J")) // First letter of name
})

test("CommentThread renders user initials from email when no name", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Test",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: null, email: "test@example.com" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("t")) // First letter of email
})

test("CommentThread displays user role badges", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Admin comment",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "Admin User", email: "admin@example.com", role: "SUPERADMIN" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("SUPERADMIN"))
})

test("CommentThread renders mention badges in comments", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Hello @[Alice](user-1), please review",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "Bob", email: "bob@example.com" },
          mentions: [{ id: "user-1", name: "Alice", email: "alice@example.com" }],
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Alice"))
})

test("CommentThread displays mention list below comment", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Mentioning people",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "User", email: "user@example.com" },
          mentions: [
            { id: "user-2", name: "Person One", email: "p1@example.com" },
            { id: "user-3", name: "Person Two", email: "p2@example.com" },
          ],
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Person One"))
  assert.ok(markup.includes("Person Two"))
})

test("CommentThread handles comments without mentions", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Simple comment",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "User", email: "user@example.com" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Simple comment"))
})

test("CommentThread renders textarea for new comments", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Leave a comment"))
  assert.ok(markup.includes("Post"))
})

test("CommentThread renders post button", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Post"))
})

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

test("extractMentions handles consecutive mentions", () => {
  const text = "@[User1](id-1)@[User2](id-2)@[User3](id-3)"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions.length, 3)
})

test("ensureMentionMarkup handles empty mentions array", () => {
  const content = "Hello @Someone"
  const result = ensureMentionMarkup(content, [])
  assert.strictEqual(result, "Hello @Someone")
})

test("commentInputSchema handles very long content", () => {
  const longContent = "A".repeat(10000)
  const input = { content: longContent }
  const parsed = commentInputSchema.parse(input)
  assert.strictEqual(parsed.content.length, 10000)
})

test("extractMentions handles mentions with newlines in between", () => {
  const text = "@[User1](id-1)\n\nSome text\n\n@[User2](id-2)"
  const result = extractMentions(text)
  assert.strictEqual(result.mentions.length, 2)
  assert.ok(result.plainText.includes("@User1"))
  assert.ok(result.plainText.includes("@User2"))
})

test("mentionTokenRegex handles mentions with numbers in IDs", () => {
  const text = "@[User](user-123-abc-456)"
  const matches = Array.from(text.matchAll(mentionTokenRegex))
  assert.strictEqual(matches.length, 1)
  assert.strictEqual(matches[0][2], "user-123-abc-456")
})

test("ensureMentionMarkup handles case-sensitive mentions correctly", () => {
  const content = "Hello @john and @John"
  const mentions = [
    { id: "user-1", display: "john" },
    { id: "user-2", display: "John" },
  ]
  const result = ensureMentionMarkup(content, mentions)
  assert.ok(result.includes("@[john](user-1)"))
  assert.ok(result.includes("@[John](user-2)"))
})

test("CommentThread handles Date objects for createdAt", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Test",
          createdAt: new Date(),
          user: { id: "u1", name: "User", email: "user@example.com" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Test"))
})

test("CommentThread handles ISO string for createdAt", () => {
  const markup = renderToString(
    <CommentThread
      entityId="entity-123"
      entityType="INVOICE"
      initialComments={[
        {
          id: "c1",
          content: "Test",
          createdAt: new Date().toISOString(),
          user: { id: "u1", name: "User", email: "user@example.com" },
        },
      ]}
      fetchOnMount={false}
    />
  )
  assert.ok(markup.includes("Test"))
})

// Run all tests
tests.forEach(({ name, run }) => {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
})

console.log(`\n✅ All ${tests.length} tests passed!`)
