import { NextRequest } from "next/server"
import { handleCommentRequest } from "@/app/api/comments/handler"
import { CommentEntityType } from "@prisma/client"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, CommentEntityType.PROJECT_BUDGET, params.id)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, CommentEntityType.PROJECT_BUDGET, params.id)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, CommentEntityType.PROJECT_BUDGET, params.id)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, CommentEntityType.PROJECT_BUDGET, params.id)
}
