'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import {
  CheckCircle,
  XCircle,
  FileText,
  Send,
  DollarSign,
  Download,
  Eye,
} from 'lucide-react';
import { ProgressClaimPDFPreview } from './progress-claim-pdf-preview';

interface ClaimItem {
  description: string;
  unit: string;
  unitRate: number | string;
  totalQuantity: number | string;
  previousClaimedPct: number | string;
  currentClaimQty: number | string;
  currentClaimPct: number | string;
  cumulativePct: number | string;
  currentClaimAmount: number | string;
}

interface ViewProgressClaimDialogProps {
  claim: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function ViewProgressClaimDialog({
  claim,
  onClose,
  onUpdate,
}: ViewProgressClaimDialogProps) {
  const [loading, setLoading] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [customerApprovedAmount, setCustomerApprovedAmount] = useState('');
  const [approvedDocument, setApprovedDocument] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!confirm('Submit this claim to client for approval?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/progress-claims/${claim.id}/submit`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to submit claim');

      toast.success('Progress claim submitted to client');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      
      let response;
      // Use FormData if we have a document or approved amount, otherwise use JSON
      if (approvedDocument || customerApprovedAmount) {
        const formData = new FormData();
        formData.append('approvalNotes', approvalNotes);
        if (customerApprovedAmount) {
          formData.append('customerApprovedAmount', customerApprovedAmount);
        }
        if (approvedDocument) {
          formData.append('approvedDocument', approvedDocument);
        }

        response = await fetch(`/api/progress-claims/${claim.id}/approve`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to approve claim');
      } else {
        // Backwards compatibility - JSON for simple approvals
        response = await fetch(`/api/progress-claims/${claim.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalNotes }),
        });

        if (!response.ok) throw new Error('Failed to approve claim');
      }

      const data = await response.json();
      
      // Show success message with invoice info if available
      if (data.invoice) {
        toast.success(
          `Progress claim approved and draft invoice ${data.invoice.invoiceNumber} created! Invoice has been synced to Xero for final approval.`,
          { duration: 6000 }
        );
      } else {
        toast.success(data.message || 'Progress claim approved');
      }
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Failed to approve claim');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/progress-claims/${claim.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      if (!response.ok) throw new Error('Failed to reject claim');

      toast.success('Progress claim rejected');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Failed to reject claim');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!confirm('Convert this approved claim to a customer invoice?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/progress-claims/${claim.id}/convert-to-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to convert to invoice');

      const invoice = await response.json();
      toast.success(`Invoice ${invoice.invoiceNumber} created successfully`);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast.error('Failed to convert to invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(numAmount || 0);
  };

  const formatNumber = (value: number | string, decimals: number = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return (num || 0).toFixed(decimals);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    const statusColors = {
      DRAFT: 'secondary',
      SUBMITTED: 'default',
      APPROVED: 'default',
      REJECTED: 'destructive',
      INVOICED: 'default',
    };

    return (
      <Badge variant={statusColors[claim.status as keyof typeof statusColors] as any}>
        {claim.status}
      </Badge>
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{claim.claimNumber}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{claim.claimTitle}</p>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">
              <FileText className="h-4 w-4 mr-2" />
              Claim Details
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              PDF Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 py-4">
          {/* Claim Information */}
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{claim.Project?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{claim.Project?.Customer?.companyName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="font-medium">{claim.CreatedBy?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Claim Date</p>
              <p className="font-medium">{formatDate(claim.claimDate)}</p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-lg mb-3">Financial Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Previous Claims</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(claim.previousClaimedAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Claim</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(claim.currentClaimAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cumulative</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(claim.cumulativeAmount)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
              {claim.retentionAmount > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Retention ({claim.retentionPercentage}%)
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">
                    - {formatCurrency(claim.retentionAmount)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                <p className="text-sm font-medium">
                  {formatCurrency(claim.subTotal || (claim.currentClaimAmount - (claim.retentionAmount || 0)))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  GST ({claim.gstRate || 9}%)
                </p>
                <p className="text-sm font-medium">
                  {formatCurrency(claim.gstAmount || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Net Amount Payable</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(claim.netClaimAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Bill of Quantities</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">#</th>
                      <th className="p-2 text-left font-medium">Description</th>
                      <th className="p-2 text-left font-medium">Unit</th>
                      <th className="p-2 text-right font-medium">Unit Rate</th>
                      <th className="p-2 text-right font-medium">Total Qty</th>
                      <th className="p-2 text-right font-medium">Previous %</th>
                      <th className="p-2 text-right font-medium">Current Qty</th>
                      <th className="p-2 text-right font-medium">Current %</th>
                      <th className="p-2 text-right font-medium">Cumulative %</th>
                      <th className="p-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claim.items?.map((item: ClaimItem, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="p-2">{item.unit}</td>
                        <td className="p-2 text-right">{formatCurrency(item.unitRate)}</td>
                        <td className="p-2 text-right">{formatNumber(item.totalQuantity)}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {formatNumber(item.previousClaimedPct)}%
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatNumber(item.currentClaimQty)}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatNumber(item.currentClaimPct)}%
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatNumber(item.cumulativePct)}%
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatCurrency(item.currentClaimAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Status Information */}
          {claim.status === 'SUBMITTED' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📤 This claim was submitted to the client on {formatDate(claim.submittedToClientAt)}
              </p>
            </div>
          )}

          {claim.status === 'APPROVED' && (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-500 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-green-800 dark:text-green-200 mb-1">
                    ✅ Customer Approved
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Approved on {formatDate(claim.approvedByClientAt)}
                    {claim.ApprovedByClient && ` by ${claim.ApprovedByClient.name}`}
                  </p>
                  
                  {/* Customer Approved Amount */}
                  {claim.customerApprovedAmount && (
                    <div className="mt-2 p-2 bg-white dark:bg-green-900 rounded border border-green-300 dark:border-green-700">
                      <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                        Customer Approved Amount:
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-green-800 dark:text-green-200">
                          {formatCurrency(claim.customerApprovedAmount)}
                        </p>
                        {parseFloat(claim.customerApprovedAmount) !== parseFloat(claim.currentClaimAmount) && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            (Claimed: {formatCurrency(claim.currentClaimAmount)})
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Approved Document */}
                  {claim.customerApprovedDocumentUrl && (
                    <div className="mt-2 p-2 bg-white dark:bg-green-900 rounded border border-green-300 dark:border-green-700">
                      <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                        Customer Approved Document:
                      </p>
                      <a
                        href={claim.customerApprovedDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        {claim.customerApprovedDocumentName || 'Download Document'}
                      </a>
                    </div>
                  )}

                  {/* Approval Notes */}
                  {claim.approvalNotes && (
                    <div className="mt-2 p-2 bg-white dark:bg-green-900 rounded border border-green-300 dark:border-green-700">
                      <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                        Approval Notes:
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 italic">
                        "{claim.approvalNotes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {claim.status === 'REJECTED' && (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg space-y-2">
              <p className="text-sm text-red-800 dark:text-red-200">
                ❌ This claim was rejected on {formatDate(claim.rejectedByClientAt)}
              </p>
              {claim.rejectionReason && (
                <p className="text-xs text-red-700 dark:text-red-300">
                  Reason: {claim.rejectionReason}
                </p>
              )}
            </div>
          )}

          {claim.status === 'INVOICED' && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                💰 This claim was converted to invoice on {formatDate(claim.invoicedAt)}
              </p>
            </div>
          )}

          {/* Approval Form */}
          {showApprovalForm && (
            <div className="border-2 border-green-500 rounded-lg p-4 space-y-4 bg-green-50 dark:bg-green-950">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-800 dark:text-green-200">
                  Record Customer Approval
                </h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                This will mark the progress claim as approved by the customer and record the approval in the system.
              </p>

              {/* Customer Approved Amount */}
              <div className="space-y-2">
                <Label htmlFor="customerApprovedAmount" className="text-green-800 dark:text-green-200">
                  Customer Approved Amount (optional)
                </Label>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Claimed Amount: {formatCurrency(claim.currentClaimAmount)}. 
                  Only fill this if customer approved a different amount.
                </p>
                <input
                  id="customerApprovedAmount"
                  type="number"
                  step="0.01"
                  value={customerApprovedAmount}
                  onChange={(e) => setCustomerApprovedAmount(e.target.value)}
                  placeholder="Leave blank to use claimed amount"
                  className="w-full px-3 py-2 border border-green-300 rounded-md bg-white dark:bg-green-900 text-green-900 dark:text-green-100"
                />
              </div>

              {/* Document Upload */}
              <div className="space-y-2">
                <Label htmlFor="approvedDocument" className="text-green-800 dark:text-green-200">
                  Customer Approved/Signed Document (optional)
                </Label>
                <input
                  id="approvedDocument"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setApprovedDocument(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-green-300 rounded-md bg-white dark:bg-green-900 text-green-900 dark:text-green-100"
                />
                {approvedDocument && (
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Selected: {approvedDocument.name} ({(approvedDocument.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {/* Approval Notes */}
              <div className="space-y-2">
                <Label htmlFor="approvalNotes" className="text-green-800 dark:text-green-200">
                  Customer Approval Notes (optional)
                </Label>
                <Textarea
                  id="approvalNotes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="E.g., Approved via email on [date], Customer reference: XXX"
                  rows={3}
                  className="bg-white dark:bg-green-900"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowApprovalForm(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleApprove} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {loading ? 'Recording Approval...' : 'Confirm Customer Approval'}
                </Button>
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {showRejectionForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-red-50 dark:bg-red-950">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowRejectionForm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={loading}>
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
          </TabsContent>

          <TabsContent value="preview" className="py-4">
            <ProgressClaimPDFPreview
              claimId={claim.id}
              claimNumber={claim.claimNumber}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          {claim.status === 'DRAFT' && (
            <Button onClick={handleSubmit} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Submit to Client
            </Button>
          )}

          {claim.status === 'SUBMITTED' && !showApprovalForm && !showRejectionForm && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectionForm(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => setShowApprovalForm(true)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Customer Approval
              </Button>
            </>
          )}

          {claim.status === 'APPROVED' && !claim.invoiceId && (
            <Button onClick={handleConvertToInvoice} disabled={loading}>
              <DollarSign className="h-4 w-4 mr-2" />
              {loading ? 'Converting...' : 'Convert to Invoice'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
