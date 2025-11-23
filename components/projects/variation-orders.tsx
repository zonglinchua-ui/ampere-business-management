
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Edit3,
  Send,
  Loader2,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface VariationOrder {
  id: string
  quotationNumber: string
  title: string
  description?: string
  variationOrderType: 'ADDITION' | 'DEDUCTION' | 'MODIFICATION'
  status: string
  totalAmount: number
  createdAt: string
  approvedAt?: string
  isCustomerApproved: boolean
  customerApprovedAt?: string
  User_Quotation_createdByIdToUser: {
    firstName: string
    lastName: string
  }
  User_Quotation_approvedByIdToUser?: {
    firstName: string
    lastName: string
  }
  User_Quotation_customerApprovedByIdToUser?: {
    firstName: string
    lastName: string
  }
}

interface VariationOrdersProps {
  projectId: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Edit3 },
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  SENT: { label: 'Sent', color: 'bg-blue-100 text-blue-800', icon: Send },
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  DECLINED: { label: 'Declined', color: 'bg-red-100 text-red-800', icon: XCircle },
}

const typeConfig = {
  ADDITION: { label: 'Addition', color: 'text-green-600', icon: TrendingUp },
  DEDUCTION: { label: 'Deduction', color: 'text-red-600', icon: TrendingDown },
  MODIFICATION: { label: 'Modification', color: 'text-blue-600', icon: Edit3 },
}

export function VariationOrders({ projectId }: VariationOrdersProps) {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const [variationOrders, setVariationOrders] = useState<VariationOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [totalAmount, setTotalAmount] = useState(0)
  const [approvedAmount, setApprovedAmount] = useState(0)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  useEffect(() => {
    fetchVariationOrders()
  }, [projectId])

  const fetchVariationOrders = async () => {
    try {
      console.log('[Frontend] Fetching variation orders for project:', projectId)
      const response = await fetch(`/api/quotations?projectId=${projectId}&isVariationOrder=true`)
      console.log('[Frontend] Fetch response status:', response.status)
      
      if (!response.ok) throw new Error('Failed to fetch variation orders')
      
      const data = await response.json()
      console.log('[Frontend] Fetched data:', data)
      
      const quotations = data.data || []
      console.log('[Frontend] Variation orders count:', quotations.length)
      console.log('[Frontend] Variation orders:', quotations.map((vo: VariationOrder) => ({
        id: vo.id,
        quotationNumber: vo.quotationNumber,
        isCustomerApproved: vo.isCustomerApproved,
        customerApprovedAt: vo.customerApprovedAt
      })))
      
      setVariationOrders(quotations)
      
      // Calculate total amount (all VOs)
      const total = quotations.reduce((sum: number, vo: VariationOrder) => {
        return sum + parseFloat(vo.totalAmount.toString())
      }, 0)
      setTotalAmount(total)
      
      // Calculate customer approved amount (only approved VOs)
      const approved = quotations.reduce((sum: number, vo: VariationOrder) => {
        if (vo.isCustomerApproved) {
          return sum + parseFloat(vo.totalAmount.toString())
        }
        return sum
      }, 0)
      console.log('[Frontend] Total amount:', total, 'Approved amount:', approved)
      setApprovedAmount(approved)
    } catch (error) {
      console.error('[Variation Orders] Fetch error:', error)
      toast.error('Failed to load variation orders')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    router.push(`/quotations/create?projectId=${projectId}&isVariationOrder=true`)
  }

  const handleView = (quotationId: string) => {
    router.push(`/quotations/${quotationId}`)
  }

  const handleToggleCustomerApproval = async (voId: string, currentStatus: boolean) => {
    try {
      console.log('[Frontend] Starting customer approval toggle:', { voId, currentStatus, newStatus: !currentStatus })
      setApprovingId(voId)
      
      const requestBody = {
        isApproved: !currentStatus,
      }
      console.log('[Frontend] Request body:', requestBody)
      
      const response = await fetch(`/api/quotations/${voId}/customer-approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[Frontend] Response status:', response.status)
      console.log('[Frontend] Response ok:', response.ok)

      if (!response.ok) {
        const error = await response.json()
        console.error('[Frontend] API error response:', error)
        throw new Error(error.error || 'Failed to update approval status')
      }

      const result = await response.json()
      console.log('[Frontend] API success response:', result)

      toast.success(
        !currentStatus
          ? 'Variation order approved by customer'
          : 'Customer approval revoked'
      )
      
      // Refresh the list
      console.log('[Frontend] Refreshing variation orders list...')
      await fetchVariationOrders()
      console.log('[Frontend] Variation orders list refreshed')
    } catch (error: any) {
      console.error('[Frontend] Toggle Customer Approval Error:', error)
      console.error('[Frontend] Error message:', error.message)
      console.error('[Frontend] Error stack:', error.stack)
      toast.error(error.message || 'Failed to update approval status')
    } finally {
      setApprovingId(null)
      console.log('[Frontend] Customer approval toggle completed')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Totals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Variation Orders</CardTitle>
              <CardDescription>
                Variation orders created as quotations for this project
              </CardDescription>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right border-r pr-6">
                <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                <p className="text-xs text-muted-foreground">Total VO Amount</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(approvedAmount)}</div>
                <p className="text-xs text-muted-foreground">Customer Approved</p>
              </div>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Variation Order
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Variation Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {variationOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No variation orders yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleCreateNew}
              >
                Create your first variation order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer Approval</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variationOrders.map((vo) => {
                    const TypeIcon = vo.variationOrderType ? typeConfig[vo.variationOrderType].icon : FileText
                    const StatusIcon = statusConfig[vo.status]?.icon || FileText

                    return (
                      <TableRow key={vo.id}>
                        <TableCell className="font-mono text-sm">
                          {vo.quotationNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{vo.title}</div>
                            {vo.description && (
                              <div className="text-xs text-gray-500 line-clamp-1">
                                {vo.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {vo.variationOrderType && (
                            <div className="flex items-center space-x-2">
                              <TypeIcon className={`h-4 w-4 ${typeConfig[vo.variationOrderType].color}`} />
                              <span className="text-sm">{typeConfig[vo.variationOrderType].label}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(vo.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[vo.status]?.color || 'bg-gray-100 text-gray-800'}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[vo.status]?.label || vo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            {vo.isCustomerApproved ? (
                              <>
                                <Badge className="bg-green-100 text-green-800 w-fit">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                                {vo.customerApprovedAt && (
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(vo.customerApprovedAt), 'MMM dd, yyyy')}
                                  </span>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 w-fit">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {vo.User_Quotation_createdByIdToUser.firstName} {vo.User_Quotation_createdByIdToUser.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(vo.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleView(vo.id)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant={vo.isCustomerApproved ? "destructive" : "default"}
                              onClick={() => handleToggleCustomerApproval(vo.id, vo.isCustomerApproved)}
                              disabled={approvingId === vo.id}
                            >
                              {approvingId === vo.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : vo.isCustomerApproved ? (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
