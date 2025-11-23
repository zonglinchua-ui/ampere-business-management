// @ts-nocheck
import assert from "assert"
import React from "react"
import { renderToString } from "react-dom/server"
import { CommentThread } from "../components/comments/CommentThread"
import { canModifyComment, commentInputSchema, extractMentions } from "../lib/comments"

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

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

tests.forEach(({ name, run }) => {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
})
