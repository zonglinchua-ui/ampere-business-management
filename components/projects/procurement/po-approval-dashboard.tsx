'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  Calendar,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface PORequest {
  id: string;
  poNumber: string;
  poDate: string;
  deliveryDate: string | null;
  deliveryAddress: string | null;
  totalAmount: number;
  currency: string;
  taxAmount: number | null;
  paymentTerms: string;
  customPaymentTerms: string | null;
  termsAndConditions: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  Quotation: {
    id: string;
    documentNumber: string | null;
    Supplier: {
      id: string;
      name: string;
    };
    LineItems: Array<{
      description: string;
      quantity: number | null;
      unitPrice: number | null;
      amount: number;
    }>;
  };
  Project: {
    id: string;
    name: string;
    projectNumber: string;
  };
  Supplier: {
    id: string;
    name: string;
  };
  RequestedBy: {
    id: string;
    name: string;
    email: string;
  };
  ApprovedBy: {
    id: string;
    name: string;
  } | null;
  GeneratedPO: {
    id: string;
    documentNumber: string | null;
    fileName: string;
  } | null;
}

interface POApprovalDashboardProps {
  projectId?: string;
  showAllProjects?: boolean;
}

export default function POApprovalDashboard({
  projectId,
  showAllProjects = false,
}: POApprovalDashboardProps) {
  const [poRequests, setPORequests] = useState<PORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<PORequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionComments, setActionComments] = useState('');

  useEffect(() => {
    fetchPORequests();
  }, [projectId, filterStatus]);

  const fetchPORequests = async () => {
    try {
      setLoading(true);
      const url = projectId
        ? `/api/projects/${projectId}/procurement/generate-po?status=${filterStatus}`
        : `/api/procurement/all-po-requests?status=${filterStatus}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setPORequests(data.poRequests);
      }
    } catch (error) {
      console.error('Error fetching PO requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return;

    if (action === 'REJECTED' && !actionComments.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(
        `/api/projects/${selectedRequest.Project.id}/procurement/approve-po`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poRequestId: selectedRequest.id,
            action,
            comments: actionComments,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process approval');
      }

      alert(data.message);
      setSelectedRequest(null);
      setActionComments('');
      fetchPORequests();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert(error instanceof Error ? error.message : 'Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">PO Approval Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve purchase order generation requests
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex space-x-2">
        {['PENDING', 'APPROVED', 'REJECTED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* PO Requests List */}
      {poRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600">No {filterStatus.toLowerCase()} PO requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {poRequests.map((request) => (
            <div
              key={request.id}
              className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${
                request.status === 'PENDING' ? 'border-yellow-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {request.status === 'PENDING' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        Pending Approval
                      </span>
                    )}
                    {request.status === 'APPROVED' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Approved
                      </span>
                    )}
                    {request.status === 'REJECTED' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                        Rejected
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1">
                    PO #{request.poNumber} - {request.Supplier.name}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                    <div>
                      <FileText className="inline h-3 w-3 mr-1" />
                      Project: {request.Project.projectNumber}
                    </div>
                    <div>
                      <DollarSign className="inline h-3 w-3 mr-1" />
                      Amount: {formatCurrency(request.totalAmount, request.currency)}
                    </div>
                    <div>
                      <Calendar className="inline h-3 w-3 mr-1" />
                      PO Date: {formatDate(request.poDate)}
                    </div>
                    <div>
                      <User className="inline h-3 w-3 mr-1" />
                      Requested by: {request.RequestedBy.name}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    Quotation: {request.Quotation.documentNumber || 'N/A'} •{' '}
                    {request.Quotation.LineItems.length} line items
                  </p>

                  {request.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-800">
                        <strong>Rejection Reason:</strong> {request.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>

                {request.status === 'PENDING' && (
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !processing && setSelectedRequest(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Review PO Request</h2>
                <button
                  onClick={() => !processing && setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={processing}
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* PO Details */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-500">PO Number</label>
                    <p className="text-gray-900 font-semibold">{selectedRequest.poNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">PO Date</label>
                    <p className="text-gray-900">{formatDate(selectedRequest.poDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Supplier</label>
                    <p className="text-gray-900">{selectedRequest.Supplier.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Project</label>
                    <p className="text-gray-900">
                      {selectedRequest.Project.projectNumber} - {selectedRequest.Project.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <p className="text-gray-900 font-bold text-lg">
                      {formatCurrency(selectedRequest.totalAmount, selectedRequest.currency)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                    <p className="text-gray-900">
                      {selectedRequest.paymentTerms.replace(/_/g, ' ')}
                      {selectedRequest.customPaymentTerms && ` - ${selectedRequest.customPaymentTerms}`}
                    </p>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Line Items</label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            Description
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Unit Price
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedRequest.Quotation.LineItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {item.quantity?.toFixed(2) || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {item.unitPrice
                                ? formatCurrency(item.unitPrice, selectedRequest.currency)
                                : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                              {formatCurrency(item.amount, selectedRequest.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Terms & Conditions */}
                {selectedRequest.termsAndConditions && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Terms & Conditions
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                      {selectedRequest.termsAndConditions}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Comments (Required for rejection)
                  </label>
                  <textarea
                    value={actionComments}
                    onChange={(e) => setActionComments(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add comments about this approval/rejection..."
                    disabled={processing}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => handleApproval('REJECTED')}
                    disabled={processing}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Processing...
                      </span>
                    ) : (
                      'Reject'
                    )}
                  </button>
                  <button
                    onClick={() => handleApproval('APPROVED')}
                    disabled={processing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Processing...
                      </span>
                    ) : (
                      'Approve & Generate PO'
                    )}
                  </button>
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> Approving this request will automatically generate
                      a PDF PO document and save it to the project folder and central PO repository.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
