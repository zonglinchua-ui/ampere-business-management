'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, Truck, FileCheck, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface POGenerationFormProps {
  projectId: string;
  quotation: {
    id: string;
    documentNumber: string | null;
    totalAmount: number | null;
    taxAmount: number | null;
    currency: string | null;
    paymentTerms: string | null;
    customPaymentTerms: string | null;
    termsAndConditions: string | null;
    Supplier: {
      id: string;
      name: string;
    } | null;
    LineItems: Array<{
      description: string;
      quantity: number | null;
      unitPrice: number | null;
      amount: number;
    }>;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PAYMENT_TERMS = [
  { value: 'NET_7', label: 'Net 7 Days' },
  { value: 'NET_15', label: 'Net 15 Days' },
  { value: 'NET_30', label: 'Net 30 Days' },
  { value: 'NET_45', label: 'Net 45 Days' },
  { value: 'NET_60', label: 'Net 60 Days' },
  { value: 'NET_90', label: 'Net 90 Days' },
  { value: 'IMMEDIATE', label: 'Immediate Payment' },
  { value: 'CUSTOM', label: 'Custom Terms' },
];

export default function POGenerationForm({
  projectId,
  quotation,
  onSuccess,
  onCancel,
}: POGenerationFormProps) {
  const [formData, setFormData] = useState({
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    deliveryAddress: '',
    totalAmount: quotation.totalAmount || 0,
    taxAmount: quotation.taxAmount || 0,
    paymentTerms: quotation.paymentTerms || 'NET_30',
    customPaymentTerms: quotation.customPaymentTerms || '',
    termsAndConditions: quotation.termsAndConditions || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    // Generate PO number
    generatePONumber();
  }, []);

  const generatePONumber = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/procurement/generate-po?action=nextNumber`);
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, poNumber: data.nextPONumber }));
      } else {
        // Fallback to timestamp-based PO number
        const timestamp = Date.now();
        setFormData((prev) => ({ ...prev, poNumber: `PO${timestamp}` }));
      }
    } catch (error) {
      // Fallback
      const timestamp = Date.now();
      setFormData((prev) => ({ ...prev, poNumber: `PO${timestamp}` }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quotation.Supplier) {
      setStatus({ type: 'error', message: 'Quotation must have a supplier' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch(`/api/projects/${projectId}/procurement/generate-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationId: quotation.id,
          supplierId: quotation.Supplier.id,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create PO request');
      }

      setStatus({
        type: 'success',
        message: 'PO generation request submitted successfully! Awaiting superadmin approval.',
      });

      if (onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }
    } catch (error) {
      console.error('Error submitting PO request:', error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit PO request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const subtotal = formData.totalAmount - formData.taxAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quotation Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Source Quotation</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Quotation #:</span>
            <span className="ml-2 font-medium">{quotation.documentNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-600">Supplier:</span>
            <span className="ml-2 font-medium">{quotation.Supplier?.name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-600">Amount:</span>
            <span className="ml-2 font-medium">
              {quotation.currency} {quotation.totalAmount?.toLocaleString() || '0'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Line Items:</span>
            <span className="ml-2 font-medium">{quotation.LineItems?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="inline h-4 w-4 mr-1" />
            PO Number *
          </label>
          <input
            type="text"
            value={formData.poNumber}
            onChange={(e) => handleChange('poNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            PO Date *
          </label>
          <input
            type="date"
            value={formData.poDate}
            onChange={(e) => handleChange('poDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Truck className="inline h-4 w-4 mr-1" />
            Delivery Date
          </label>
          <input
            type="date"
            value={formData.deliveryDate}
            onChange={(e) => handleChange('deliveryDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Address
          </label>
          <input
            type="text"
            value={formData.deliveryAddress}
            onChange={(e) => handleChange('deliveryAddress', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Optional delivery address"
          />
        </div>
      </div>

      {/* Financial Details */}
      <div className="border border-gray-300 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          <DollarSign className="inline h-4 w-4 mr-1" />
          Financial Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal</label>
            <input
              type="number"
              value={subtotal}
              onChange={(e) => {
                const newSubtotal = parseFloat(e.target.value) || 0;
                handleChange('totalAmount', newSubtotal + formData.taxAmount);
              }}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tax Amount</label>
            <input
              type="number"
              value={formData.taxAmount}
              onChange={(e) => {
                const newTax = parseFloat(e.target.value) || 0;
                handleChange('taxAmount', newTax);
                handleChange('totalAmount', subtotal + newTax);
              }}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount *</label>
            <input
              type="number"
              value={formData.totalAmount}
              onChange={(e) => handleChange('totalAmount', parseFloat(e.target.value) || 0)}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              required
            />
          </div>
        </div>
      </div>

      {/* Payment Terms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FileCheck className="inline h-4 w-4 mr-1" />
          Payment Terms *
        </label>
        <select
          value={formData.paymentTerms}
          onChange={(e) => handleChange('paymentTerms', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          {PAYMENT_TERMS.map((term) => (
            <option key={term.value} value={term.value}>
              {term.label}
            </option>
          ))}
        </select>

        {formData.paymentTerms === 'CUSTOM' && (
          <input
            type="text"
            value={formData.customPaymentTerms}
            onChange={(e) => handleChange('customPaymentTerms', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mt-2"
            placeholder="Enter custom payment terms"
            required
          />
        )}
      </div>

      {/* Terms & Conditions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Terms & Conditions
        </label>
        <textarea
          value={formData.termsAndConditions}
          onChange={(e) => handleChange('termsAndConditions', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Enter terms and conditions for this PO..."
        />
      </div>

      {/* Status Message */}
      {status.type && (
        <div
          className={`flex items-start space-x-2 p-4 rounded-lg ${
            status.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            submitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {submitting ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Submitting...
            </span>
          ) : (
            'Submit for Approval'
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> This PO request will be sent to superadmin for approval. Once
          approved, a PDF PO document will be automatically generated and saved to the project
          folder and central PO repository.
        </p>
      </div>
    </form>
  );
}
