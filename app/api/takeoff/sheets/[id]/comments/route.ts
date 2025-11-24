import { NextRequest } from "next/server"
import { handleCommentRequest } from "@/app/api/comments/handler"
import { CommentEntityTypeEnum } from "@/lib/comments"

const ENTITY_TYPE = CommentEntityTypeEnum.TAKEOFF_SHEET

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, ENTITY_TYPE, params.id)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, ENTITY_TYPE, params.id)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, ENTITY_TYPE, params.id)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleCommentRequest(req, ENTITY_TYPE, params.id)
}
