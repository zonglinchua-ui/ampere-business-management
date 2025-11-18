'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import POGenerationForm from './po-generation-form';

interface VO {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
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
  LineItems: Array<{
    id: string;
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number;
  }>;
}

interface VOHandlerProps {
  projectId: string;
  vo: VO;
  onProcessed?: () => void;
}

export default function VOHandler({ projectId, vo, onProcessed }: VOHandlerProps) {
  const [availablePOs, setAvailablePOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [revisedPOData, setRevisedPOData] = useState<any>(null);

  useEffect(() => {
    if (vo.Supplier) {
      fetchAvailablePOs();
    }
  }, [vo.Supplier?.id]);

  const fetchAvailablePOs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/procurement/link-invoice?supplierId=${vo.Supplier?.id}`
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

  const handleGenerateRevisedPO = () => {
    if (!selectedPO) {
      alert('Please select the original PO first');
      return;
    }

    const originalPO = availablePOs.find((po) => po.id === selectedPO);
    if (!originalPO) return;

    // Calculate revised amounts
    const originalAmount = originalPO.totalAmount || 0;
    const voAmount = vo.totalAmount || 0;
    const revisedTotal = originalAmount + voAmount;

    // Prepare revised PO data (simulating quotation structure for the form)
    setRevisedPOData({
      id: vo.id, // Use VO ID as the "quotation" ID
      documentNumber: vo.documentNumber,
      totalAmount: revisedTotal,
      taxAmount: vo.taxAmount || 0,
      currency: vo.currency || originalPO.currency,
      paymentTerms: originalPO.paymentTerms,
      customPaymentTerms: originalPO.customPaymentTerms,
      termsAndConditions: `REVISED PO - Original PO: ${originalPO.documentNumber}\n\nVariation Order: ${vo.documentNumber}\nOriginal Amount: ${originalPO.currency} ${originalAmount.toLocaleString()}\nVO Amount: ${vo.currency} ${voAmount.toLocaleString()}\nRevised Total: ${vo.currency} ${revisedTotal.toLocaleString()}\n\n${originalPO.termsAndConditions || ''}`,
      Supplier: vo.Supplier,
      LineItems: [
        {
          description: `Original PO Amount (${originalPO.documentNumber})`,
          quantity: 1,
          unitPrice: originalAmount,
          amount: originalAmount,
        },
        {
          description: `Variation Order (${vo.documentNumber})`,
          quantity: 1,
          unitPrice: voAmount,
          amount: voAmount,
        },
        ...vo.LineItems,
      ],
    });

    setShowPOForm(true);
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

  // If VO already has a revised PO
  if (vo.linkedPOId && vo.LinkedPO) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">Revised PO Generated</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Revised PO:</span>
                <span className="ml-2 font-medium">{vo.LinkedPO.documentNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Revised Amount:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(vo.LinkedPO.totalAmount, vo.LinkedPO.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If showing PO generation form
  if (showPOForm && revisedPOData) {
    return (
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 mb-2 flex items-center">
            <RefreshCw className="h-5 w-5 mr-2" />
            Generate Revised PO
          </h3>
          <p className="text-sm text-purple-800">
            This will create a new PO that includes the original PO amount plus the variation order
            amount. The revised PO will require superadmin approval.
          </p>
        </div>

        <POGenerationForm
          projectId={projectId}
          quotation={revisedPOData}
          onSuccess={() => {
            setShowPOForm(false);
            if (onProcessed) {
              onProcessed();
            }
          }}
          onCancel={() => setShowPOForm(false)}
        />
      </div>
    );
  }

  // Show VO processing interface
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Variation Order Requires Action</h3>
            <p className="text-sm text-red-800 mt-1">
              This variation order must be linked to the original PO and a revised PO must be
              generated before payment can be processed.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-red-200">
          <div>
            <span className="text-gray-600">VO Number:</span>
            <span className="ml-2 font-medium">{vo.documentNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-600">VO Amount:</span>
            <span className="ml-2 font-medium">{formatCurrency(vo.totalAmount, vo.currency)}</span>
          </div>
          <div>
            <span className="text-gray-600">Supplier:</span>
            <span className="ml-2 font-medium">{vo.Supplier?.name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-600">Date:</span>
            <span className="ml-2 font-medium">{formatDate(vo.documentDate)}</span>
          </div>
        </div>
      </div>

      {!vo.Supplier ? (
        <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
          Cannot process VO: No supplier information available
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : availablePOs.length === 0 ? (
        <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
          No approved POs found for supplier: {vo.Supplier.name}. Please ensure an original PO
          exists before processing this VO.
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Original Purchase Order
            </label>
            <select
              value={selectedPO}
              onChange={(e) => setSelectedPO(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Original PO --</option>
              {availablePOs.map((po) => (
                <option key={po.id} value={po.id}>
                  PO {po.documentNumber || 'N/A'} - {formatCurrency(po.totalAmount, po.currency)}{' '}
                  ({formatDate(po.documentDate)})
                </option>
              ))}
            </select>
          </div>

          {selectedPO && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              {(() => {
                const originalPO = availablePOs.find((po) => po.id === selectedPO);
                if (!originalPO) return null;

                const originalAmount = originalPO.totalAmount || 0;
                const voAmount = vo.totalAmount || 0;
                const revisedTotal = originalAmount + voAmount;

                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original PO Amount:</span>
                      <span className="font-medium">
                        {formatCurrency(originalAmount, originalPO.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">VO Amount:</span>
                      <span className="font-medium text-red-600">
                        + {formatCurrency(voAmount, vo.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600 font-semibold">Revised Total:</span>
                      <span className="font-bold text-lg">
                        {formatCurrency(revisedTotal, vo.currency)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <button
            onClick={handleGenerateRevisedPO}
            disabled={!selectedPO}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              !selectedPO
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <RefreshCw className="inline h-5 w-5 mr-2" />
            Generate Revised PO
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>VO Processing Workflow:</strong>
        </p>
        <ol className="mt-2 space-y-1 text-sm text-blue-800 list-decimal list-inside">
          <li>Select the original PO that this VO relates to</li>
          <li>System calculates the revised total (Original PO + VO)</li>
          <li>Generate a revised PO with the new amount</li>
          <li>Revised PO requires superadmin approval</li>
          <li>Once approved, payment can be processed against the revised PO</li>
        </ol>
      </div>
    </div>
  );
}
