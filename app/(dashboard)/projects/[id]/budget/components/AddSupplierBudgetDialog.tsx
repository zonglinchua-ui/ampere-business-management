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
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddSupplierBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

interface Supplier {
  id: string;
  name: string;
}

export default function AddSupplierBudgetDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AddSupplierBudgetDialogProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    supplierId: "",
    tradeType: "",
    description: "",
    quotedAmount: "",
    quotedAmountBeforeTax: "",
    quotedTaxAmount: "",
    quotationReference: "",
    quotationDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-calculate tax if amount before tax is entered
    if (field === "quotedAmountBeforeTax" && value) {
      const beforeTax = parseFloat(value);
      const taxRate = 0.09; // 9% GST (adjust as needed)
      const taxAmount = beforeTax * taxRate;
      const totalAmount = beforeTax + taxAmount;

      setFormData((prev) => ({
        ...prev,
        quotedTaxAmount: taxAmount.toFixed(2),
        quotedAmount: totalAmount.toFixed(2),
      }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.supplierId || !formData.tradeType || !formData.quotedAmount) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/budget/supplier-items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplierId: formData.supplierId,
            tradeType: formData.tradeType,
            description: formData.description,
            quotedAmount: parseFloat(formData.quotedAmount),
            quotedAmountBeforeTax: formData.quotedAmountBeforeTax
              ? parseFloat(formData.quotedAmountBeforeTax)
              : null,
            quotedTaxAmount: formData.quotedTaxAmount
              ? parseFloat(formData.quotedTaxAmount)
              : null,
            quotationReference: formData.quotationReference || null,
            quotationDate: formData.quotationDate || null,
            notes: formData.notes || null,
          }),
        }
      );

      if (response.ok) {
        onSuccess();
        handleClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create budget item");
      }
    } catch (error) {
      console.error("Create budget item error:", error);
      setError("Failed to create budget item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      supplierId: "",
      tradeType: "",
      description: "",
      quotedAmount: "",
      quotedAmountBeforeTax: "",
      quotedTaxAmount: "",
      quotationReference: "",
      quotationDate: "",
      notes: "",
    });
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Supplier Budget (Manual Entry)</DialogTitle>
          <DialogDescription>
            Manually add a supplier budget entry without uploading a quotation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(value) => handleChange("supplierId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
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

          {/* Quoted Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quotedAmount">Quoted Amount (Total) *</Label>
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
              <Label htmlFor="quotedAmountBeforeTax">
                Amount Before Tax
              </Label>
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
          </div>

          {/* Tax Amount */}
          <div className="space-y-2">
            <Label htmlFor="quotedTaxAmount">Tax Amount (GST)</Label>
            <Input
              id="quotedTaxAmount"
              type="number"
              step="0.01"
              value={formData.quotedTaxAmount}
              onChange={(e) => handleChange("quotedTaxAmount", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500">
              Auto-calculated if amount before tax is entered
            </p>
          </div>

          {/* Quotation Reference */}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
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
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.supplierId ||
              !formData.tradeType ||
              !formData.quotedAmount ||
              saving
            }
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Budget Item
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
