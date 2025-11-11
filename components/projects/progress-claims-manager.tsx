
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import {
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Download,
  Trash2,
  Edit,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreateProgressClaimDialog } from './create-progress-claim-dialog';
import { ViewProgressClaimDialog } from './view-progress-claim-dialog';

interface ProgressClaim {
  id: string;
  claimNumber: string;
  claimTitle: string;
  claimDate: string;
  status: string;
  currentClaimAmount: number;
  netClaimAmount: number;
  retentionAmount: number;
  submittedToClientAt: string | null;
  approvedByClientAt: string | null;
  rejectedByClientAt: string | null;
  invoicedAt: string | null;
  approvalNotes: string | null;
  retentionPercentage: number;
  previousClaimedAmount: number;
  cumulativeAmount: number;
  CreatedBy: {
    name: string;
    email: string;
  };
  ApprovedByClient?: {
    name: string;
    email: string;
  } | null;
  items: any[];
}

interface ProgressClaimsManagerProps {
  projectId: string;
  quotationId?: string;
  customerId: string;
}

export function ProgressClaimsManager({
  projectId,
  quotationId,
  customerId,
}: ProgressClaimsManagerProps) {
  const { data: session } = useSession() || {};
  const userRole = session?.user?.role;
  const isSuperAdmin = userRole === 'SUPERADMIN';
  
  const [claims, setClaims] = useState<ProgressClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ProgressClaim | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [baseClaim, setBaseClaim] = useState<ProgressClaim | null>(null);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/progress-claims?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch progress claims');
      const data = await response.json();
      setClaims(data.claims || []);
    } catch (error) {
      console.error('Error fetching progress claims:', error);
      toast.error('Failed to load progress claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [projectId]);

  const handleViewClaim = (claim: ProgressClaim) => {
    setSelectedClaim(claim);
    setShowViewDialog(true);
  };

  const handleCreateSubsequentClaim = (claim: ProgressClaim) => {
    setBaseClaim(claim);
    setShowCreateDialog(true);
  };

  const getClaimSequence = (claimNumber: string) => {
    // Extract sequence number from claim number (e.g., PC-P001-002 -> 2)
    const match = claimNumber.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
      return `${num}${suffix}`;
    }
    return '';
  };

  const handleDelete = async (claimId: string) => {
    const claim = claims.find(c => c.id === claimId);
    const isNonDraft = claim && claim.status !== 'DRAFT';
    
    const confirmMessage = isNonDraft && isSuperAdmin
      ? `⚠️ SUPERADMIN ACTION: You are about to delete a ${claim.status} claim.\n\nThis is an administrative override that should only be used to correct errors.\n\nProgress claim: ${claim.claimNumber}\nStatus: ${claim.status}\n\nAre you absolutely sure?`
      : 'Are you sure you want to delete this progress claim?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/progress-claims/${claimId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete progress claim');
      }

      toast.success(
        isNonDraft && isSuperAdmin 
          ? '✅ Progress claim deleted (SUPERADMIN override)' 
          : 'Progress claim deleted successfully'
      );
      fetchClaims();
    } catch (error: any) {
      console.error('Error deleting progress claim:', error);
      toast.error(error.message || 'Failed to delete progress claim');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: 'secondary' as const, icon: Clock },
      SUBMITTED: { variant: 'default' as const, icon: FileText },
      APPROVED: { variant: 'default' as const, icon: CheckCircle },
      REJECTED: { variant: 'destructive' as const, icon: XCircle },
      INVOICED: { variant: 'default' as const, icon: DollarSign },
      CANCELLED: { variant: 'secondary' as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Progress Claims</h2>
          <p className="text-sm text-muted-foreground">
            Manage progress payment claims for this project
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Progress Claim
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Progress Claims Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first progress claim to start tracking project payments
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Progress Claim
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {claims.map((claim, index) => (
            <Card 
              key={claim.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewClaim(claim)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{claim.claimNumber}</h3>
                      <Badge variant="outline" className="text-xs">
                        {getClaimSequence(claim.claimNumber)} Claim
                      </Badge>
                      {getStatusBadge(claim.status)}
                      {claim.status === 'APPROVED' && claim.ApprovedByClient && (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Customer Approved
                        </Badge>
                      )}
                      {isSuperAdmin && claim.status !== 'DRAFT' && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-xs">
                          🔐 Editable by Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {claim.claimTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created by {claim.CreatedBy.name} on {formatDate(claim.claimDate)}
                    </p>
                    {claim.ApprovedByClient && claim.approvalNotes && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">
                        📝 {claim.approvalNotes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {(claim.status === 'APPROVED' || claim.status === 'INVOICED') && index === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateSubsequentClaim(claim)}
                        className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create Next Claim
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewClaim(claim)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    {(claim.status === 'DRAFT' || isSuperAdmin) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(claim.id)}
                        title={isSuperAdmin && claim.status !== 'DRAFT' ? 'SUPERADMIN: Delete any claim' : 'Delete draft claim'}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Claim Amount</p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(claim.currentClaimAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Retention</p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(claim.retentionAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Net Amount</p>
                    <p className="text-sm font-semibold text-primary">
                      {formatCurrency(claim.netClaimAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Items</p>
                    <p className="text-sm font-semibold">{claim.items.length}</p>
                  </div>
                </div>

                {claim.status === 'SUBMITTED' && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      📤 Submitted to client on {formatDate(claim.submittedToClientAt)}
                    </p>
                  </div>
                )}

                {claim.status === 'APPROVED' && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                          Customer Approved
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          Approved on {formatDate(claim.approvedByClientAt)}
                          {claim.ApprovedByClient && ` by ${claim.ApprovedByClient.name}`}
                        </p>
                        {claim.approvalNotes && (
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">
                            "{claim.approvalNotes}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {claim.status === 'REJECTED' && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                    <p className="text-xs text-red-800 dark:text-red-200">
                      ❌ Rejected on {formatDate(claim.rejectedByClientAt)}
                    </p>
                  </div>
                )}

                {claim.status === 'INVOICED' && (
                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-md">
                    <p className="text-xs text-purple-800 dark:text-purple-200">
                      💰 Converted to invoice on {formatDate(claim.invoicedAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateProgressClaimDialog
          projectId={projectId}
          quotationId={quotationId}
          baseClaim={baseClaim}
          onClose={() => {
            setShowCreateDialog(false);
            setBaseClaim(null);
          }}
          onSuccess={() => {
            setShowCreateDialog(false);
            setBaseClaim(null);
            fetchClaims();
          }}
        />
      )}

      {showViewDialog && selectedClaim && (
        <ViewProgressClaimDialog
          claim={selectedClaim}
          onClose={() => {
            setShowViewDialog(false);
            setSelectedClaim(null);
          }}
          onUpdate={() => {
            fetchClaims();
          }}
        />
      )}
    </div>
  );
}
