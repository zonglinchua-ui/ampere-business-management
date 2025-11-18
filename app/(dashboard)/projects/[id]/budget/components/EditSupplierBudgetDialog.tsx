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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditSupplierBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  budgetItem: any;
  onSuccess: () => void;
}

export default function EditSupplierBudgetDialog({
  open,
  onOpenChange,
  projectId,
  budgetItem,
  onSuccess,
}: EditSupplierBudgetDialogProps) {
  const [formData, setFormData] = useState({
    tradeType: "",
    description: "",
    quotedAmount: "",
    quotedAmountBeforeTax: "",
    quotedTaxAmount: "",
    quotationReference: "",
    quotationDate: "",
    actualCost: "",
    actualCostBeforeTax: "",
    actualTaxAmount: "",
    status: "",
    isApproved: false,
    notes: "",
    internalNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (budgetItem && open) {
      setFormData({
        tradeType: budgetItem.tradeType || "",
        description: budgetItem.description || "",
        quotedAmount: budgetItem.quotedAmount?.toString() || "",
        quotedAmountBeforeTax:
          budgetItem.quotedAmountBeforeTax?.toString() || "",
        quotedTaxAmount: budgetItem.quotedTaxAmount?.toString() || "",
        quotationReference: budgetItem.quotationReference || "",
        quotationDate: budgetItem.quotationDate
          ? new Date(budgetItem.quotationDate).toISOString().split("T")[0]
          : "",
        actualCost: budgetItem.actualCost?.toString() || "",
        actualCostBeforeTax: budgetItem.actualCostBeforeTax?.toString() || "",
        actualTaxAmount: budgetItem.actualTaxAmount?.toString() || "",
        status: budgetItem.status || "",
        isApproved: budgetItem.isApproved || false,
        notes: budgetItem.notes || "",
        internalNotes: budgetItem.internalNotes || "",
      });
    }
  }, [budgetItem, open]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-calculate tax if amount before tax is entered
    if (field === "quotedAmountBeforeTax" && typeof value === "string") {
      const beforeTax = parseFloat(value);
      if (!isNaN(beforeTax)) {
        const taxRate = 0.09; // 9% GST
        const taxAmount = beforeTax * taxRate;
        const totalAmount = beforeTax + taxAmount;

        setFormData((prev) => ({
          ...prev,
          quotedTaxAmount: taxAmount.toFixed(2),
          quotedAmount: totalAmount.toFixed(2),
        }));
      }
    }

    if (field === "actualCostBeforeTax" && typeof value === "string") {
      const beforeTax = parseFloat(value);
      if (!isNaN(beforeTax)) {
        const taxRate = 0.09; // 9% GST
        const taxAmount = beforeTax * taxRate;
        const totalAmount = beforeTax + taxAmount;

        setFormData((prev) => ({
          ...prev,
          actualTaxAmount: taxAmount.toFixed(2),
          actualCost: totalAmount.toFixed(2),
        }));
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/budget/supplier-items/${budgetItem.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tradeType: formData.tradeType,
            description: formData.description,
            quotedAmount: formData.quotedAmount
              ? parseFloat(formData.quotedAmount)
              : undefined,
            quotedAmountBeforeTax: formData.quotedAmountBeforeTax
              ? parseFloat(formData.quotedAmountBeforeTax)
              : null,
            quotedTaxAmount: formData.quotedTaxAmount
              ? parseFloat(formData.quotedTaxAmount)
              : null,
            quotationReference: formData.quotationReference || null,
            quotationDate: formData.quotationDate || null,
            actualCost: formData.actualCost
              ? parseFloat(formData.actualCost)
              : undefined,
            actualCostBeforeTax: formData.actualCostBeforeTax
              ? parseFloat(formData.actualCostBeforeTax)
              : null,
            actualTaxAmount: formData.actualTaxAmount
              ? parseFloat(formData.actualTaxAmount)
              : null,
            status: formData.status,
            isApproved: formData.isApproved,
            notes: formData.notes || null,
            internalNotes: formData.internalNotes || null,
          }),
        }
      );

      if (response.ok) {
        onSuccess();
        handleClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update budget item");
      }
    } catch (error) {
      console.error("Update budget item error:", error);
      setError("Failed to update budget item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setError("");
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

  const statuses = [
    "QUOTED",
    "PENDING_APPROVAL",
    "APPROVED",
    "PO_ISSUED",
    "IN_PROGRESS",
    "COMPLETED",
    "INVOICED",
    "PAID",
    "CANCELLED",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Supplier Budget</DialogTitle>
          <DialogDescription>
            Update budget details for {budgetItem?.supplierName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AI Extraction Info */}
          {budgetItem?.extractedByAI && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This budget was extracted from a quotation using AI with{" "}
                {((budgetItem.aiConfidence || 0) * 100).toFixed(0)}% confidence.
                Please review and update as needed.
              </AlertDescription>
            </Alert>
          )}

          {/* Trade Type */}
          <div className="space-y-2">
            <Label htmlFor="tradeType">Trade Type *</Label>
            <Select
              value={formData.tradeType}
              onValueChange={(value) => handleChange("tradeType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trade type" />
              </SelectTrigger>
              <SelectContent>
                {tradeTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Brief description of work"
            />
          </div>

          {/* Quoted Amounts */}
          <div className="space-y-2">
            <Label className="font-semibold">Quoted Amounts</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quotedAmount">Total Amount *</Label>
                <Input
                  id="quotedAmount"
                  type="number"
                  step="0.01"
                  value={formData.quotedAmount}
                  onChange={(e) => handleChange("quotedAmount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedAmountBeforeTax">Before Tax</Label>
                <Input
                  id="quotedAmountBeforeTax"
                  type="number"
                  step="0.01"
                  value={formData.quotedAmountBeforeTax}
                  onChange={(e) =>
                    handleChange("quotedAmountBeforeTax", e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedTaxAmount">Tax (GST)</Label>
                <Input
                  id="quotedTaxAmount"
                  type="number"
                  step="0.01"
                  value={formData.quotedTaxAmount}
                  onChange={(e) =>
                    handleChange("quotedTaxAmount", e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Actual Costs */}
          <div className="space-y-2">
            <Label className="font-semibold">Actual Costs</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actualCost">Total Cost</Label>
                <Input
                  id="actualCost"
                  type="number"
                  step="0.01"
                  value={formData.actualCost}
                  onChange={(e) => handleChange("actualCost", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualCostBeforeTax">Before Tax</Label>
                <Input
                  id="actualCostBeforeTax"
                  type="number"
                  step="0.01"
                  value={formData.actualCostBeforeTax}
                  onChange={(e) =>
                    handleChange("actualCostBeforeTax", e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualTaxAmount">Tax (GST)</Label>
                <Input
                  id="actualTaxAmount"
                  type="number"
                  step="0.01"
                  value={formData.actualTaxAmount}
                  onChange={(e) =>
                    handleChange("actualTaxAmount", e.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Quotation Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quotationReference">Quotation Reference</Label>
              <Input
                id="quotationReference"
                value={formData.quotationReference}
                onChange={(e) =>
                  handleChange("quotationReference", e.target.value)
                }
                placeholder="QT-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotationDate">Quotation Date</Label>
              <Input
                id="quotationDate"
                type="date"
                value={formData.quotationDate}
                onChange={(e) => handleChange("quotationDate", e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isApproved">Approval Status</Label>
              <div className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  id="isApproved"
                  checked={formData.isApproved}
                  onChange={(e) =>
                    handleChange("isApproved", e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="isApproved" className="cursor-pointer">
                  {formData.isApproved ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Approved
                    </span>
                  ) : (
                    "Not Approved"
                  )}
                </Label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Visible to all)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes or comments"
              rows={2}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal Notes (Private)</Label>
            <Textarea
              id="internalNotes"
              value={formData.internalNotes}
              onChange={(e) => handleChange("internalNotes", e.target.value)}
              placeholder="Private notes for internal use only"
              rows={2}
            />
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
