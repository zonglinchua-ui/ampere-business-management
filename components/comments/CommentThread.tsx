'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { mentionTokenRegex } from '@/lib/comments'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export type CommentEntity =
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'PROJECT_BUDGET'
  | 'TAKEOFF_SHEET'
  | 'TAKEOFF_MEASUREMENT'

export type CommentUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
}

export type CommentMention = {
  id: string
  name?: string | null
  email?: string | null
}

export type CommentRecord = {
  id: string
  content: string
  createdAt: string | Date
  updatedAt?: string | Date
  user: CommentUser
  mentions?: CommentMention[]
}

const endpointMap: Record<CommentEntity, string> = {
  INVOICE: '/api/invoices',
  PURCHASE_ORDER: '/api/pos',
  PROJECT_BUDGET: '/api/budgets',
  TAKEOFF_SHEET: '/api/takeoff/sheets',
  TAKEOFF_MEASUREMENT: '/api/takeoff/measurements',
}

interface CommentThreadProps {
  entityId: string
  entityType: CommentEntity
  initialComments?: CommentRecord[]
  fetchOnMount?: boolean
}

export function CommentThread({ entityId, entityType, initialComments = [], fetchOnMount = true }: CommentThreadProps) {
  const [comments, setComments] = useState<CommentRecord[]>(initialComments)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionResults, setMentionResults] = useState<CommentMention[]>([])
  const [selectedMentions, setSelectedMentions] = useState<CommentMention[]>([])

  const endpoint = useMemo(() => `${endpointMap[entityType]}/${entityId}/comments`, [entityId, entityType])

  useEffect(() => {
    if (!fetchOnMount) return
    loadComments()
  }, [endpoint, fetchOnMount])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (mentionQuery.length < 2) return
      searchUsers(mentionQuery)
    }, 250)

    return () => clearTimeout(handler)
  }, [mentionQuery])

  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Unable to load comments')
      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error(error)
      toast.error('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`)
    if (!response.ok) return
    const data = await response.json()
    setMentionResults(data.results || [])
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    const activeMention = value.split(/\s+/).find((token) => token.startsWith('@') && token.length > 1)
    setMentionQuery(activeMention ? activeMention.slice(1) : '')
  }

  const insertMention = (mention: CommentMention) => {
    const label = mention.name || mention.email || 'user'
    const token = `@[${label}](${mention.id})`
    setContent((prev) => prev.replace(/@[^\s]*$/, token))
    setSelectedMentions((prev) => {
      if (prev.find((item) => item.id === mention.id)) return prev
      return [...prev, mention]
    })
    toast.message('Mention added', { description: `${label} will be notified` })
  }

  const renderContent = (text: string) => {
    const nodes: React.ReactNode[] = []
    let lastIndex = 0

    text.replace(mentionTokenRegex, (match, display, id, offset) => {
      if (offset > lastIndex) {
        nodes.push(text.slice(lastIndex, offset))
      }
      nodes.push(
        <Badge key={`${id}-${offset}`} variant="outline" className="mx-0.5">
          @{display}
        </Badge>
      )
      lastIndex = offset + match.length
      return match
    })

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex))
    }

    return nodes
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    try {
      setSaving(true)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mentions: selectedMentions }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save comment')
      }

      const newComment = await response.json()
      setComments((prev) => [...prev, newComment])
      setContent('')
      setSelectedMentions([])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Unable to save comment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center space-x-2">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Comments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="Leave a comment. Mention teammates with @"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={3}
          />
          {mentionQuery && mentionResults.length > 0 && (
            <div className="border rounded-md p-2 bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Mentions</div>
              <div className="space-y-1">
                {mentionResults.map((user) => (
                  <button
                    key={user.id}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-muted"
                    onClick={() => insertMention(user)}
                  >
                    <span>{user.name || user.email}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Post</span>
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading comments...</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[320px] pr-2">
              <div className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
                )}
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3 rounded-md border p-3">
                    <Avatar>
                      <AvatarFallback>
                        {comment.user?.name?.[0] || comment.user?.email?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="space-x-2 text-sm">
                          <span className="font-semibold">{comment.user?.name || comment.user?.email}</span>
                          {comment.user?.role && (
                            <Badge variant="secondary" className="text-xs">
                              {comment.user.role}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed break-words">{renderContent(comment.content)}</div>
                      {comment.mentions && comment.mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {comment.mentions.map((mention) => (
                            <Badge key={`${comment.id}-${mention.id}`} variant="outline" className="text-xs">
                              @{mention.name || mention.email}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
