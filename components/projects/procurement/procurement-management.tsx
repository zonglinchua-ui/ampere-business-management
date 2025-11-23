'use client';

import React, { useState } from 'react';
import { FileText, Upload, List, Settings } from 'lucide-react';
import DocumentUpload from './document-upload';
import DocumentListEnhanced from './document-list-enhanced';

interface ProcurementManagementProps {
  projectId: string;
}

export default function ProcurementManagement({ projectId }: ProcurementManagementProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    // Refresh document list
    setRefreshTrigger((prev) => prev + 1);
    // Switch to list view
    setActiveTab('list');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Procurement Documents</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage quotations, POs, invoices, and variation orders with AI-powered extraction
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <List className="h-5 w-5" />
              <span>Document List</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Upload Document</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'list' && (
          <DocumentListEnhanced projectId={projectId} refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'upload' && (
          <DocumentUpload projectId={projectId} onUploadComplete={handleUploadComplete} />
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Quotations</p>
              <p className="text-2xl font-bold text-purple-900">-</p>
            </div>
            <FileText className="h-8 w-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Supplier POs</p>
              <p className="text-2xl font-bold text-orange-900">-</p>
            </div>
            <FileText className="h-8 w-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Invoices</p>
              <p className="text-2xl font-bold text-green-900">-</p>
            </div>
            <FileText className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">VOs</p>
              <p className="text-2xl font-bold text-red-900">-</p>
            </div>
            <FileText className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Procurement Workflow Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="flex items-start space-x-2">
            <div className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <strong>Upload & Extract:</strong> Upload quotations, POs, and invoices. AI
              automatically extracts amounts, line items, and terms.
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <strong>Generate POs:</strong> Convert approved quotations into supplier POs with
              editable terms and payment conditions.
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <strong>Invoice Matching:</strong> Link supplier invoices to POs for 3-way matching
              and payment approval.
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              4
            </div>
            <div>
              <strong>VO Handling:</strong> Upload variation orders and generate revised POs with
              approval workflow.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
