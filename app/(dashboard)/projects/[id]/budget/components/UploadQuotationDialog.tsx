"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

interface Supplier {
  id: string;
  name: string;
}

export default function UploadQuotationDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: UploadQuotationDialogProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [needsReview, setNeedsReview] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`/api/suppliers`);
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError("Only PDF and image files (PNG, JPEG) are allowed");
        setFile(null);
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedSupplierId) {
      setError("Please select a supplier and file");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", selectedSupplierId);
      if (tradeType) {
        formData.append("tradeType", tradeType);
      }

      const response = await fetch(
        `/api/projects/${projectId}/budget/upload-quotation`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setExtractedData(data.extractedData);
        setNeedsReview(data.needsReview);

        if (data.needsReview) {
          // Show extracted data for review
          setError("");
        } else {
          // Success, close dialog
          onSuccess();
          handleClose();
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to upload quotation");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setError("Failed to upload quotation. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSelectedSupplierId("");
    setTradeType("");
    setError("");
    setExtractedData(null);
    setNeedsReview(false);
    onOpenChange(false);
  };

  const tradeTypes = [
    "Electrical",
    "Plumbing",
    "Aircon",
    "Carpentry",
    "Painting",
    "Flooring",
    "Ceiling",
    "Masonry",
    "Roofing",
    "General",
    "Other",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Quotation</DialogTitle>
          <DialogDescription>
            Upload a quotation PDF or image. AI will extract the supplier name,
            amount, and other details automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select
              value={selectedSupplierId}
              onValueChange={setSelectedSupplierId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Type */}
          <div className="space-y-2">
            <Label htmlFor="tradeType">Trade Type (Optional)</Label>
            <Select value={tradeType} onValueChange={setTradeType}>
              <SelectTrigger>
                <SelectValue placeholder="Select trade type" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {tradeTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              AI will attempt to detect this from the quotation
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Quotation File *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Supported formats: PDF, PNG, JPEG (max 10MB)
            </p>
          </div>

          {/* Extracted Data Preview */}
          {extractedData && needsReview && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    AI Extraction Complete - Please Review:
                  </p>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Supplier:</strong> {extractedData.supplierName}
                    </p>
                    <p>
                      <strong>Reference:</strong>{" "}
                      {extractedData.quotationReference || "N/A"}
                    </p>
                    <p>
                      <strong>Amount:</strong> $
                      {extractedData.totalAmount?.toFixed(2) || "0.00"}
                    </p>
                    <p>
                      <strong>Trade Type:</strong>{" "}
                      {extractedData.tradeType || "N/A"}
                    </p>
                    <p>
                      <strong>Confidence:</strong>{" "}
                      {(extractedData.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    The quotation has been saved. You can edit the details in
                    the budget table.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          {needsReview && extractedData ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <Button
              onClick={handleUpload}
              disabled={!file || !selectedSupplierId || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading & Extracting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Quotation
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
