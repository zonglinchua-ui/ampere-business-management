import { CommentEntityType } from "@prisma/client"
import { z } from "zod"

export const mentionTokenRegex = /@\[([^\]]+)\]\(([^)]+)\)/g

export const mentionSchema = z.object({
  id: z.string(),
  display: z.string().optional(),
  email: z.string().email().optional()
})

export const commentInputSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty"),
  mentions: z.array(mentionSchema).optional().default([])
})

export const commentUpdateSchema = z.object({
  commentId: z.string(),
  content: z.string().trim().min(1, "Comment cannot be empty"),
  mentions: z.array(mentionSchema).optional().default([])
})

export const commentDeleteSchema = z.object({
  commentId: z.string()
})

export type ParsedMention = {
  id: string
  display: string
}

export function extractMentions(content: string): { mentions: ParsedMention[]; plainText: string } {
  const mentions: ParsedMention[] = []
  const plainText = content.replace(mentionTokenRegex, (_, display, id) => {
    mentions.push({ id, display })
    return `@${display}`
  })

  return { mentions, plainText: plainText.trim() }
}

export function ensureMentionMarkup(content: string, selectedMentions: ParsedMention[]) {
  let updatedContent = content
  selectedMentions.forEach((mention) => {
    if (!mention.display) return
    const token = `@${mention.display}`
    if (updatedContent.includes(token) && !updatedContent.includes(`@[${mention.display}](${mention.id})`)) {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const tokenRegex = new RegExp(escapedToken, "g")
      updatedContent = updatedContent.replace(tokenRegex, `@[${mention.display}](${mention.id})`)
    }
  })
  return updatedContent
}

export function canModifyComment(currentUserId: string | undefined, role: string | undefined, ownerId: string) {
  if (!currentUserId) return false
  if (role === "SUPERADMIN") return true
  return currentUserId === ownerId
}

export function getCommentEntityKey(entityType: CommentEntityType) {
  switch (entityType) {
    case CommentEntityType.INVOICE:
      return "invoiceId"
    case CommentEntityType.PURCHASE_ORDER:
      return "purchaseOrderId"
    case CommentEntityType.PROJECT_BUDGET:
      return "projectId"
    default:
      return "entityId"
  }
}
