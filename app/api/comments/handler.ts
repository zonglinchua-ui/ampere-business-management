import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  canModifyComment,
  commentDeleteSchema,
  commentInputSchema,
  commentUpdateSchema,
  ensureMentionMarkup,
  CommentEntityTypeEnum,
  ExtendedCommentEntityType,
  getCommentEntityKey,
} from "@/lib/comments"
import { CommentEntityType } from "@prisma/client"

type EntityChecker = (id: string) => Promise<unknown>

const entityCheckers: Record<
  ExtendedCommentEntityType,
  EntityChecker
> = {
  [CommentEntityTypeEnum.INVOICE]: (id: string) =>
    prisma.customerInvoice.findUnique({ where: { id }, select: { id: true } }),
  [CommentEntityTypeEnum.PURCHASE_ORDER]: (id: string) =>
    prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true } }),
  [CommentEntityTypeEnum.PROJECT_BUDGET]: (id: string) =>
    prisma.project.findUnique({ where: { id }, select: { id: true } }),
  "TAKEOFF_SHEET": (id: string) =>
    prisma.planSheet.findUnique({ where: { id }, select: { id: true } }),
  "TAKEOFF_MEASUREMENT": (id: string) =>
    prisma.measurement.findUnique({ where: { id }, select: { id: true } }),
}

async function ensureEntityExists(
  entityType: ExtendedCommentEntityType,
  entityId: string
) {
  const checker = entityCheckers[entityType]
  return checker?.(entityId)
}

function mapCommentResponse(comment: any) {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: {
      id: comment.createdBy?.id,
      name: comment.createdBy?.name || comment.createdBy?.email,
      email: comment.createdBy?.email,
      role: comment.createdBy?.role,
    },
    mentions: (comment.CommentMention || []).map((mention: any) => ({
      id: mention.userId,
      name: mention.User?.name || mention.User?.email,
      email: mention.User?.email,
    })),
  }
}

function matchesEntityScope(
  entityType: ExtendedCommentEntityType,
  existingComment: any,
  entityId: string
) {
  switch (entityType) {
    case CommentEntityTypeEnum.INVOICE:
      return existingComment.invoiceId === entityId
    case CommentEntityTypeEnum.PURCHASE_ORDER:
      return existingComment.purchaseOrderId === entityId
    case CommentEntityTypeEnum.PROJECT_BUDGET:
      return existingComment.projectId === entityId
    case CommentEntityTypeEnum.TAKEOFF_SHEET:
      return existingComment.planSheetId === entityId
    case CommentEntityTypeEnum.TAKEOFF_MEASUREMENT:
      return existingComment.measurementId === entityId
    default:
      return false
  }
}

export async function handleCommentRequest(
  req: NextRequest,
  entityType: ExtendedCommentEntityType,
  entityId: string
) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  const role = (session?.user as any)?.role as string | undefined

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const entityExists = await ensureEntityExists(entityType, entityId)
  if (!entityExists) {
    return NextResponse.json({ error: "Parent record not found" }, { status: 404 })
  }

  const entityKey = getCommentEntityKey(entityType)

  if (req.method === "GET") {
    const comments = await prisma.comment.findMany({
      where: { entityType: entityType as CommentEntityType, [entityKey]: entityId },
      include: {
        createdBy: true,
        CommentMention: {
          include: {
            User: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ comments: comments.map(mapCommentResponse) })
  }

  if (req.method === "POST") {
    const body = await req.json()
    const { content, mentions } = commentInputSchema.parse(body)
    const mentionRecords = (mentions || []).reduce((acc: any[], mention) => {
      if (!acc.find((existing) => existing.userId === mention.id)) {
        acc.push({ userId: mention.id })
      }
      return acc
    }, [])

    const normalizedContent = ensureMentionMarkup(
      content,
      (mentions || []).map((mention) => ({ id: mention.id, display: mention.display || mention.id }))
    )

    const newComment = await prisma.comment.create({
      data: {
        content: normalizedContent,
        entityType: entityType as CommentEntityType,
        [entityKey]: entityId,
        createdById: userId,
        CommentMention: mentionRecords.length
          ? { createMany: { data: mentionRecords } }
          : undefined,
      },
      include: {
        createdBy: true,
        CommentMention: {
          include: { User: true },
        },
      },
    })

    return NextResponse.json(mapCommentResponse(newComment), { status: 201 })
  }

  if (req.method === "PUT") {
    const body = await req.json()
    const { commentId, content, mentions } = commentUpdateSchema.parse(body)

    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { createdBy: true },
    })

    const matchesEntity = existingComment
      ? matchesEntityScope(entityType, existingComment, entityId)
      : false

    if (!existingComment || existingComment.entityType !== entityType || !matchesEntity) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    if (!canModifyComment(userId, role, existingComment.createdById)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const mentionRecords = (mentions || []).reduce((acc: any[], mention) => {
      if (!acc.find((existing) => existing.userId === mention.id)) {
        acc.push({ userId: mention.id })
      }
      return acc
    }, [])

    const normalizedContent = ensureMentionMarkup(
      content,
      (mentions || []).map((mention) => ({ id: mention.id, display: mention.display || mention.id }))
    )

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: normalizedContent,
        CommentMention: {
          deleteMany: {},
          createMany: mentionRecords.length ? { data: mentionRecords } : undefined,
        },
      },
      include: {
        createdBy: true,
        CommentMention: {
          include: { User: true },
        },
      },
    })

    return NextResponse.json(mapCommentResponse(updatedComment))
  }

  if (req.method === "DELETE") {
    const body = await req.json()
    const { commentId } = commentDeleteSchema.parse(body)

    const existingComment = await prisma.comment.findUnique({ where: { id: commentId } })
    const matchesEntity = existingComment
      ? matchesEntityScope(entityType, existingComment, entityId)
      : false

    if (!existingComment || existingComment.entityType !== entityType || !matchesEntity) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    if (!canModifyComment(userId, role, existingComment.createdById)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.comment.delete({ where: { id: commentId } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
