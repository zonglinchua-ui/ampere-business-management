'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Loader2,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import POGenerationForm from './po-generation-form';
import InvoiceMatching from './invoice-matching';
import VOHandler from './vo-handler';

interface ProcurementDocument {
  id: string;
  documentType: string;
  documentNumber: string | null;
  documentDate: string | null;
  status: string;
  fileName: string;
  originalFileName: string;
  totalAmount: number | null;
  taxAmount: number | null;
  currency: string | null;
  extractionConfidence: number | null;
  paymentTerms: string | null;
  customPaymentTerms: string | null;
  termsAndConditions: string | null;
  linkedPOId: string | null;
  Supplier: { id: string; name: string } | null;
  Customer: { id: string; name: string } | null;
  UploadedBy: { id: string; name: string; email: string };
  createdAt: string;
  LineItems: Array<{
    id: string;
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number;
  }>;
  LinkedQuotation: { id: string; documentNumber: string | null } | null;
  LinkedPO: { id: string; documentNumber: string | null; totalAmount: number | null; currency: string | null } | null;
  LinkedVO: { id: string; documentNumber: string | null } | null;
}

interface DocumentListProps {
  projectId: string;
  refreshTrigger?: number;
}

const DOCUMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  CUSTOMER_PO: { label: 'Customer PO', color: 'bg-blue-100 text-blue-800' },
  SUPPLIER_QUOTATION: { label: 'Supplier Quotation', color: 'bg-purple-100 text-purple-800' },
  SUPPLIER_INVOICE: { label: 'Supplier Invoice', color: 'bg-green-100 text-green-800' },
  SUPPLIER_PO: { label: 'Supplier PO', color: 'bg-orange-100 text-orange-800' },
  CLIENT_INVOICE: { label: 'Client Invoice', color: 'bg-teal-100 text-teal-800' },
  VARIATION_ORDER: { label: 'Variation Order', color: 'bg-red-100 text-red-800' },
};

const STATUS_ICONS: Record<string, { icon: any; color: string }> = {
  UPLOADED: { icon: Clock, color: 'text-gray-500' },
  EXTRACTED: { icon: CheckCircle, color: 'text-green-500' },
  PENDING_APPROVAL: { icon: Clock, color: 'text-yellow-500' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600' },
  REJECTED: { icon: XCircle, color: 'text-red-500' },
  LINKED: { icon: LinkIcon, color: 'text-blue-500' },
  PAID: { icon: CheckCircle, color: 'text-green-700' },
  CANCELLED: { icon: XCircle, color: 'text-gray-500' },
};

export default function DocumentListEnhanced({ projectId, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<ProcurementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedDocument, setSelectedDocument] = useState<ProcurementDocument | null>(null);
  const [actionMode, setActionMode] = useState<'view' | 'generate-po' | 'match-invoice' | 'handle-vo' | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [projectId, refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.append('documentType', filterType);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);

      const response = await fetch(
        `/api/projects/${projectId}/procurement/documents?${params.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/procurement/documents?documentId=${documentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleAction = (doc: ProcurementDocument, mode: 'view' | 'generate-po' | 'match-invoice' | 'handle-vo') => {
    setSelectedDocument(doc);
    setActionMode(mode);
  };

  const closeModal = () => {
    setSelectedDocument(null);
    setActionMode(null);
    fetchDocuments();
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

  const canGeneratePO = (doc: ProcurementDocument) => {
    return (
      doc.documentType === 'SUPPLIER_QUOTATION' &&
      doc.status !== 'PENDING_APPROVAL' &&
      doc.status !== 'APPROVED' &&
      !doc.LinkedPO
    );
  };

  const needsInvoiceMatching = (doc: ProcurementDocument) => {
    return doc.documentType === 'SUPPLIER_INVOICE' && !doc.linkedPOId;
  };

  const needsVOHandling = (doc: ProcurementDocument) => {
    return doc.documentType === 'VARIATION_ORDER' && !doc.linkedPOId;
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
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              fetchDocuments();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              fetchDocuments();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="EXTRACTED">Extracted</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="LINKED">Linked</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600">No documents found</p>
          <p className="text-sm text-gray-500 mt-1">Upload a document to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const StatusIcon = STATUS_ICONS[doc.status]?.icon || Clock;
            const statusColor = STATUS_ICONS[doc.status]?.color || 'text-gray-500';
            const typeInfo = DOCUMENT_TYPE_LABELS[doc.documentType] || {
              label: doc.documentType,
              color: 'bg-gray-100 text-gray-800',
            };

            return (
              <div
                key={doc.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                      <span className="text-xs text-gray-500 capitalize">
                        {doc.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      {doc.extractionConfidence !== null && (
                        <span className="text-xs text-gray-500">
                          • AI: {doc.extractionConfidence.toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {/* Action Required Badges */}
                    <div className="flex items-center space-x-2 mb-2">
                      {needsInvoiceMatching(doc) && (
                        <>
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            ⚠️ Needs PO Linking
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowModal('invoice-matching');
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                          >
                            <LinkIcon className="h-3 w-3" />
                            Link to PO
                          </button>
                        </>
                      )}
                      {needsVOHandling(doc) && (
                        <>
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            ⚠️ Needs Revised PO
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowModal('vo-handler');
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 flex items-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Handle VO
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {doc.documentNumber || doc.originalFileName}
                        </h3>
                        {doc.Supplier && (
                          <p className="text-sm text-gray-600">Supplier: {doc.Supplier.name}</p>
                        )}
                        {doc.Customer && (
                          <p className="text-sm text-gray-600">Customer: {doc.Customer.name}</p>
                        )}
                      </div>

                      {doc.totalAmount !== null && (
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(doc.totalAmount, doc.currency)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(doc.documentDate)}</p>
                        </div>
                      )}
                    </div>

                    {doc.LineItems && doc.LineItems.length > 0 && (
                      <p className="text-xs text-gray-500 mb-2">
                        {doc.LineItems.length} line item{doc.LineItems.length > 1 ? 's' : ''}
                      </p>
                    )}

                    {(doc.LinkedQuotation || doc.LinkedPO || doc.LinkedVO) && (
                      <div className="flex items-center space-x-2 text-xs text-blue-600 mb-2">
                        <LinkIcon className="h-3 w-3" />
                        <span>
                          Linked to:{' '}
                          {doc.LinkedQuotation && `Quotation ${doc.LinkedQuotation.documentNumber}`}
                          {doc.LinkedPO && `PO ${doc.LinkedPO.documentNumber}`}
                          {doc.LinkedVO && `VO ${doc.LinkedVO.documentNumber}`}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Uploaded by {doc.UploadedBy.name} on {formatDate(doc.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {canGeneratePO(doc) && (
                      <button
                        onClick={() => handleAction(doc, 'generate-po')}
                        className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded"
                        title="Generate PO"
                      >
                        <FileCheck className="h-5 w-5" />
                      </button>
                    )}
                    {needsInvoiceMatching(doc) && (
                      <button
                        onClick={() => handleAction(doc, 'match-invoice')}
                        className="p-2 text-white bg-yellow-600 hover:bg-yellow-700 rounded"
                        title="Link to PO"
                      >
                        <LinkIcon className="h-5 w-5" />
                      </button>
                    )}
                    {needsVOHandling(doc) && (
                      <button
                        onClick={() => handleAction(doc, 'handle-vo')}
                        className="p-2 text-white bg-red-600 hover:bg-red-700 rounded"
                        title="Handle VO"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(doc, 'view')}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View Details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedDocument && actionMode && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {actionMode === 'generate-po' && 'Generate Purchase Order'}
                  {actionMode === 'match-invoice' && 'Link Invoice to PO'}
                  {actionMode === 'handle-vo' && 'Handle Variation Order'}
                  {actionMode === 'view' && 'Document Details'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {actionMode === 'generate-po' && (
                <POGenerationForm
                  projectId={projectId}
                  quotation={selectedDocument}
                  onSuccess={closeModal}
                  onCancel={closeModal}
                />
              )}

              {actionMode === 'match-invoice' && (
                <InvoiceMatching
                  projectId={projectId}
                  invoice={selectedDocument}
                  onLinked={closeModal}
                />
              )}

              {actionMode === 'handle-vo' && (
                <VOHandler
                  projectId={projectId}
                  vo={selectedDocument}
                  onProcessed={closeModal}
                />
              )}

              {actionMode === 'view' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Document Number</label>
                      <p className="text-gray-900">{selectedDocument.documentNumber || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date</label>
                      <p className="text-gray-900">{formatDate(selectedDocument.documentDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Total Amount</label>
                      <p className="text-gray-900">
                        {formatCurrency(selectedDocument.totalAmount, selectedDocument.currency)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className="text-gray-900 capitalize">
                        {selectedDocument.status.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>
                  </div>

                  {selectedDocument.LineItems && selectedDocument.LineItems.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">
                        Line Items
                      </label>
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
                            {selectedDocument.LineItems.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {item.description}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  {item.quantity?.toFixed(2) || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  {item.unitPrice
                                    ? formatCurrency(item.unitPrice, selectedDocument.currency)
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                  {formatCurrency(item.amount, selectedDocument.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
