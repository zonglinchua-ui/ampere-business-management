'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface DocumentUploadProps {
  projectId: string;
  onUploadComplete?: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'AUTO', label: '🤖 Auto-Detect (Recommended)', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'CUSTOMER_PO', label: 'Customer PO', color: 'bg-blue-100 text-blue-800' },
  { value: 'SUPPLIER_QUOTATION', label: 'Supplier Quotation', color: 'bg-purple-100 text-purple-800' },
  { value: 'SUPPLIER_INVOICE', label: 'Supplier Invoice', color: 'bg-green-100 text-green-800' },
  { value: 'SUPPLIER_PO', label: 'Supplier PO', color: 'bg-orange-100 text-orange-800' },
  { value: 'CLIENT_INVOICE', label: 'Client Invoice', color: 'bg-teal-100 text-teal-800' },
  { value: 'VARIATION_ORDER', label: 'Variation Order', color: 'bg-red-100 text-red-800' },
];

export default function DocumentUpload({ projectId, onUploadComplete }: DocumentUploadProps) {
  const [selectedType, setSelectedType] = useState<string>('AUTO');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | 'extracting' | null;
    message: string;
  }>({ type: null, message: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadStatus({ type: null, message: '' });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
    multiple: false,
    noClick: false,
    noKeyboard: false,
    disabled: uploading,
  });

  const pollExtractionStatus = async (docId: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/procurement/documents/${docId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error('Failed to fetch document status');
        }

        const status = data.document?.status;

        if (status === 'EXTRACTED') {
          // Extraction completed successfully
          setExtracting(false);
          const confidence = data.document.extractionConfidence || 0;
          const projectMismatch = data.document.projectMismatch;
          
          let message = `✅ AI extraction completed with ${confidence.toFixed(0)}% confidence!`;
          if (projectMismatch) {
            message += ' ⚠️ Warning: Document may belong to a different project.';
          }

          setUploadStatus({
            type: 'success',
            message: message,
          });

          // Reset form
          setSelectedFile(null);
          setNotes('');
          setDocumentId(null);

          // Notify parent component
          if (onUploadComplete) {
            onUploadComplete();
          }
        } else if (status === 'FAILED') {
          // Extraction failed
          setExtracting(false);
          setUploadStatus({
            type: 'error',
            message: '❌ AI extraction failed. Please try again or contact support.',
          });
        } else if (attempts < maxAttempts) {
          // Still processing, poll again
          attempts++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          // Timeout
          setExtracting(false);
          setUploadStatus({
            type: 'error',
            message: '⏱️ Extraction timed out. Please refresh the page to check status.',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
        setExtracting(false);
        setUploadStatus({
          type: 'error',
          message: 'Failed to check extraction status. Please refresh the page.',
        });
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 2000);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus({ type: 'error', message: 'Please select a file to upload' });
      return;
    }

    setUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', selectedType);
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch(`/api/projects/${projectId}/procurement/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // File uploaded successfully, now show extraction progress
      setUploading(false);
      setExtracting(true);
      setDocumentId(data.document.id);
      setUploadStatus({
        type: 'extracting',
        message: data.message || 'Document uploaded! AI extraction in progress...',
      });

      // Start polling for extraction status
      pollExtractionStatus(data.document.id);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload document',
      });
      setUploading(false);
      setExtracting(false);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadStatus({ type: null, message: '' });
  };

  return (
    <div className="space-y-4">
      {/* Document Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {DOCUMENT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedType === type.value
                  ? type.color + ' ring-2 ring-offset-2 ring-gray-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Document
        </label>
        
        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 cursor-copy'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 bg-white cursor-pointer'
            }`}
            style={{ cursor: 'pointer' }}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Supports PDF, Images, Word documents
            </p>
            <button
              type="button"
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                input?.click();
              }}
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="text-gray-400 hover:text-gray-600"
                disabled={uploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Add any additional notes about this document..."
          disabled={uploading}
        />
      </div>

      {/* Upload Status */}
      {uploadStatus.type && (
        <div
          className={`flex items-start space-x-2 p-4 rounded-lg ${
            uploadStatus.type === 'success'
              ? 'bg-green-50 text-green-800'
              : uploadStatus.type === 'extracting'
              ? 'bg-blue-50 text-blue-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : uploadStatus.type === 'extracting' ? (
            <Loader2 className="h-5 w-5 flex-shrink-0 mt-0.5 animate-spin" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{uploadStatus.message}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading || extracting}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          !selectedFile || uploading || extracting
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
            Uploading...
          </span>
        ) : extracting ? (
          <span className="flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
            AI Extracting...
          </span>
        ) : (
          'Upload & Extract Data'
        )}
      </button>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>AI-Powered Extraction:</strong> The system will automatically extract document
          details, amounts, line items, and payment terms using AI. You can review and edit the
          extracted data after upload.
        </p>
      </div>
    </div>
  );
}
