'use client';

import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon,
  Unlink,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  FileText,
  DollarSign,
} from 'lucide-react';

interface Invoice {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  linkedPOId: string | null;
  status: string;
  Supplier: {
    id: string;
    name: string;
  } | null;
  LinkedPO: {
    id: string;
    documentNumber: string | null;
    totalAmount: number | null;
    currency: string | null;
  } | null;
}

interface PO {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  Supplier: {
    id: string;
    name: string;
  };
  LinkedInvoices: Array<{
    id: string;
    documentNumber: string | null;
    totalAmount: number | null;
  }>;
}

interface InvoiceMatchingProps {
  projectId: string;
  invoice: Invoice;
  onLinked?: () => void;
}

export default function InvoiceMatching({ projectId, invoice, onLinked }: InvoiceMatchingProps) {
  const [availablePOs, setAvailablePOs] = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [matchingResult, setMatchingResult] = useState<any>(null);

  useEffect(() => {
    if (invoice.Supplier) {
      fetchAvailablePOs();
    }
  }, [invoice.Supplier?.id]);

  const fetchAvailablePOs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/procurement/link-invoice?supplierId=${invoice.Supplier?.id}`
      );
      const data = await response.json();

      if (data.success) {
        setAvailablePOs(data.availablePOs);
      }
    } catch (error) {
      console.error('Error fetching available POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedPO) {
      alert('Please select a PO to link');
      return;
    }

    setProcessing(true);
    setMatchingResult(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/procurement/link-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          poId: selectedPO,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link invoice');
      }

      setMatchingResult(data.matchingResult);
      
      if (onLinked) {
        setTimeout(() => onLinked(), 1500);
      }
    } catch (error) {
      console.error('Error linking invoice:', error);
      alert(error instanceof Error ? error.message : 'Failed to link invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink this invoice from the PO?')) {
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/procurement/link-invoice?invoiceId=${invoice.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        if (onLinked) {
          onLinked();
        }
      }
    } catch (error) {
      console.error('Error unlinking invoice:', error);
      alert('Failed to unlink invoice');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
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

  // If already linked
  if (invoice.linkedPOId && invoice.LinkedPO) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <LinkIcon className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Linked to PO</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">PO Number:</span>
                  <span className="ml-2 font-medium">{invoice.LinkedPO.documentNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">PO Amount:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(invoice.LinkedPO.totalAmount, invoice.LinkedPO.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Invoice Amount:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Variance:</span>
                  <span className="ml-2 font-medium">
                    {invoice.LinkedPO.totalAmount && invoice.totalAmount
                      ? formatCurrency(
                          Math.abs(invoice.totalAmount - invoice.LinkedPO.totalAmount),
                          invoice.currency
                        )
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleUnlink}
              disabled={processing}
              className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {invoice.status === 'PENDING_APPROVAL' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Requires Approval:</strong> This invoice has matching issues and requires
                superadmin approval before payment can be processed.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If not linked - show linking interface
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
          <LinkIcon className="h-5 w-5 mr-2" />
          Link Invoice to PO
        </h3>

        {!invoice.Supplier ? (
          <div className="text-sm text-gray-600">
            Cannot link invoice: No supplier information available
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : availablePOs.length === 0 ? (
          <div className="text-sm text-gray-600">
            No approved POs found for supplier: {invoice.Supplier.name}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Purchase Order
              </label>
              <select
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={processing}
              >
                <option value="">-- Select PO --</option>
                {availablePOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    PO {po.documentNumber || 'N/A'} - {formatCurrency(po.totalAmount, po.currency)}{' '}
                    ({formatDate(po.documentDate)})
                    {po.LinkedInvoices.length > 0 && ` - ${po.LinkedInvoices.length} invoice(s) linked`}
                  </option>
                ))}
              </select>
            </div>

            {selectedPO && (
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                {(() => {
                  const po = availablePOs.find((p) => p.id === selectedPO);
                  if (!po) return null;

                  const variance = invoice.totalAmount && po.totalAmount
                    ? Math.abs(invoice.totalAmount - po.totalAmount)
                    : 0;
                  const variancePercentage = po.totalAmount && po.totalAmount > 0
                    ? (variance / po.totalAmount) * 100
                    : 0;

                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">PO Amount:</span>
                        <span className="font-medium">{formatCurrency(po.totalAmount, po.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Invoice Amount:</span>
                        <span className="font-medium">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-600">Variance:</span>
                        <span className={`font-semibold ${variancePercentage > 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(variance, invoice.currency)} ({variancePercentage.toFixed(2)}%)
                        </span>
                      </div>
                      {variancePercentage > 5 && (
                        <div className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-800">
                            Amount variance exceeds 5% threshold. This will require approval.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              onClick={handleLink}
              disabled={!selectedPO || processing}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                !selectedPO || processing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {processing ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Linking...
                </span>
              ) : (
                'Link Invoice to PO'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Matching Result */}
      {matchingResult && (
        <div
          className={`border rounded-lg p-4 ${
            matchingResult.warnings.length > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-start space-x-2 mb-3">
            {matchingResult.warnings.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-semibold text-sm">
                {matchingResult.warnings.length > 0 ? 'Matching Issues Detected' : 'Successfully Linked'}
              </h4>
              {matchingResult.warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {matchingResult.warnings.map((warning: string, index: number) => (
                    <li key={index} className="text-yellow-800">
                      • {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <strong>3-Way Matching:</strong> The system will verify that the invoice amount matches
          the PO amount (within 5% tolerance) and that the supplier matches. Invoices with
          discrepancies will require superadmin approval before payment.
        </p>
      </div>
    </div>
  );
}
