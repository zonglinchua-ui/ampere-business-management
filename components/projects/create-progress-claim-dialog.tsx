'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Plus, Upload, Trash2, Download } from 'lucide-react';

interface CreateProgressClaimDialogProps {
  projectId: string;
  quotationId?: string;
  baseClaim?: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClaimItem {
  description: string;
  unit: string;
  unitRate: number;
  totalQuantity: number;
  totalAmount: number;
  previousClaimedQty: number;
  previousClaimedPct: number;
  previousClaimedAmount: number;
  currentClaimQty: number;
  currentClaimPct: number;
  currentClaimAmount: number;
  cumulativeQty: number;
  cumulativePct: number;
  cumulativeAmount: number;
  notes?: string;
}

export function CreateProgressClaimDialog({
  projectId,
  quotationId,
  baseClaim,
  onClose,
  onSuccess,
}: CreateProgressClaimDialogProps) {
  const [claimTitle, setClaimTitle] = useState('');
  const [description, setDescription] = useState('');
  const [retentionPercentage, setRetentionPercentage] = useState('0');
  const [gstRate, setGstRate] = useState('9');
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load items from base claim if provided
  useEffect(() => {
    if (baseClaim) {
      // Get claim sequence number
      const match = baseClaim.claimNumber.match(/(\d+)$/);
      const nextNum = match ? parseInt(match[1]) + 1 : 2;
      const suffix = nextNum === 2 ? 'nd' : nextNum === 3 ? 'rd' : 'th';
      
      setClaimTitle(`${nextNum}${suffix} Progress Claim`);
      setDescription(baseClaim.description || '');
      setRetentionPercentage(baseClaim.retentionPercentage?.toString() || '0');
      
      // Convert base claim items to new claim items with cumulative values as previous
      const baseItems = baseClaim.items.map((item: any) => ({
        description: item.description,
        unit: item.unit,
        unitRate: parseFloat(item.unitRate),
        totalQuantity: parseFloat(item.totalQuantity),
        totalAmount: parseFloat(item.totalAmount),
        previousClaimedQty: parseFloat(item.cumulativeQty || 0),
        previousClaimedPct: parseFloat(item.cumulativePct || 0),
        previousClaimedAmount: parseFloat(item.cumulativeAmount || 0),
        currentClaimQty: 0,
        currentClaimPct: 0,
        currentClaimAmount: 0,
        cumulativeQty: parseFloat(item.cumulativeQty || 0),
        cumulativePct: parseFloat(item.cumulativePct || 0),
        cumulativeAmount: parseFloat(item.cumulativeAmount || 0),
        notes: '',
      }));
      
      setItems(baseItems);
      toast.success(`Loaded ${baseItems.length} items from previous claim`);
    }
  }, [baseClaim]);

  const handleImportBOQ = async () => {
    if (!quotationId) {
      toast.error('No quotation linked to this project');
      return;
    }

    try {
      setImporting(true);
      const response = await fetch('/api/progress-claims/import-boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId, projectId }),
      });

      if (!response.ok) throw new Error('Failed to import BOQ');

      const data = await response.json();
      setItems(data.items || []);
      toast.success(`Imported ${data.items.length} items from quotation`);
    } catch (error) {
      console.error('Error importing BOQ:', error);
      toast.error('Failed to import BOQ');
    } finally {
      setImporting(false);
    }
  };

  const handleItemChange = (index: number, field: keyof ClaimItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Recalculate percentages and amounts
    const item = newItems[index];
    
    // First, recalculate totalAmount if unitRate or totalQuantity changed
    if (field === 'unitRate' || field === 'totalQuantity') {
      const unitRate = field === 'unitRate' ? (parseFloat(value) || 0) : item.unitRate;
      const totalQty = field === 'totalQuantity' ? (parseFloat(value) || 0) : item.totalQuantity;
      item.unitRate = unitRate;
      item.totalQuantity = totalQty;
      item.totalAmount = unitRate * totalQty;
      
      // Recalculate current claim amount based on current quantity
      if (item.totalQuantity > 0) {
        item.currentClaimAmount = (item.currentClaimQty / item.totalQuantity) * item.totalAmount;
        item.cumulativeAmount = (item.cumulativeQty / item.totalQuantity) * item.totalAmount;
        item.previousClaimedAmount = (item.previousClaimedQty / item.totalQuantity) * item.totalAmount;
      }
    } else if (field === 'currentClaimQty') {
      const currentQty = parseFloat(value) || 0;
      item.currentClaimQty = currentQty;
      
      if (item.totalQuantity > 0) {
        item.currentClaimPct = (currentQty / item.totalQuantity) * 100;
        item.currentClaimAmount = (currentQty / item.totalQuantity) * item.totalAmount;
        item.cumulativeQty = item.previousClaimedQty + currentQty;
        item.cumulativePct = (item.cumulativeQty / item.totalQuantity) * 100;
        item.cumulativeAmount = (item.cumulativeQty / item.totalQuantity) * item.totalAmount;
      }
    } else if (field === 'currentClaimPct') {
      const currentPct = parseFloat(value) || 0;
      item.currentClaimPct = currentPct;
      item.currentClaimQty = (currentPct / 100) * item.totalQuantity;
      item.currentClaimAmount = (currentPct / 100) * item.totalAmount;
      item.cumulativeQty = item.previousClaimedQty + item.currentClaimQty;
      item.cumulativePct = (item.cumulativeQty / item.totalQuantity) * 100;
      item.cumulativeAmount = (item.cumulativeQty / item.totalQuantity) * item.totalAmount;
    }

    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        unit: 'pcs',
        unitRate: 0,
        totalQuantity: 0,
        totalAmount: 0,
        previousClaimedQty: 0,
        previousClaimedPct: 0,
        previousClaimedAmount: 0,
        currentClaimQty: 0,
        currentClaimPct: 0,
        currentClaimAmount: 0,
        cumulativeQty: 0,
        cumulativePct: 0,
        cumulativeAmount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!claimTitle.trim()) {
      toast.error('Please enter a claim title');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      toast.error('All items must have a description');
      return;
    }

    try {
      setLoading(true);
      
      const requestData = {
        projectId,
        quotationId: quotationId || null,
        claimTitle,
        description,
        retentionPercentage: parseFloat(retentionPercentage) || 0,
        gstRate: parseFloat(gstRate) || 9,
        items,
      };
      
      console.log('Creating progress claim with data:', requestData);
      console.log('Items:', items);
      
      const response = await fetch('/api/progress-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        
        // Display detailed error information
        let errorMessage = errorData.error || 'Failed to create progress claim';
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
        if (errorData.prismaCode) {
          errorMessage += ` (Code: ${errorData.prismaCode})`;
        }
        if (errorData.prismaMeta) {
          console.error('Prisma meta:', errorData.prismaMeta);
        }
        if (errorData.stack) {
          console.error('Stack trace:', errorData.stack);
        }
        
        throw new Error(errorMessage);
      }

      toast.success('Progress claim created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating progress claim:', error);
      toast.error(error.message || 'Failed to create progress claim');
    } finally {
      setLoading(false);
    }
  };

  const getTotalClaimAmount = () => {
    return items.reduce((sum, item) => sum + (item.currentClaimAmount || 0), 0);
  };

  const getRetentionAmount = () => {
    const retention = parseFloat(retentionPercentage) || 0;
    return (getTotalClaimAmount() * retention) / 100;
  };

  const getSubTotal = () => {
    return getTotalClaimAmount() - getRetentionAmount();
  };

  const getGstAmount = () => {
    const gst = parseFloat(gstRate) || 0;
    return (getSubTotal() * gst) / 100;
  };

  const getNetClaimAmount = () => {
    return getSubTotal() + getGstAmount();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount || 0);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {baseClaim ? `Create Subsequent Progress Claim (Based on ${baseClaim.claimNumber})` : 'Create Progress Claim'}
          </DialogTitle>
          {baseClaim && (
            <p className="text-sm text-muted-foreground mt-2">
              ℹ️ Previous claim data has been loaded. Update quantities claimed in this period.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="claimTitle">Claim Title *</Label>
              <Input
                id="claimTitle"
                value={claimTitle}
                onChange={(e) => setClaimTitle(e.target.value)}
                placeholder="e.g., Progress Claim #1"
              />
            </div>
            <div>
              <Label htmlFor="retentionPercentage">Retention % (optional)</Label>
              <Input
                id="retentionPercentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={retentionPercentage}
                onChange={(e) => setRetentionPercentage(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="gstRate">GST %</Label>
              <Input
                id="gstRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                placeholder="9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes about this claim"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <h3 className="text-lg font-semibold">Bill of Quantities (BOQ)</h3>
            <div className="flex gap-2">
              {quotationId && !baseClaim && (
                <Button
                  variant="outline"
                  onClick={handleImportBOQ}
                  disabled={importing || items.length > 0}
                >
                  {importing ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import from Quotation
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground mb-2">No items added yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Import BOQ from quotation or add items manually
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">#</th>
                      <th className="p-2 text-left font-medium">Description</th>
                      <th className="p-2 text-left font-medium">Unit</th>
                      <th className="p-2 text-right font-medium">Unit Rate</th>
                      <th className="p-2 text-right font-medium">Total Qty</th>
                      <th className="p-2 text-right font-medium">Previous %</th>
                      <th className="p-2 text-right font-medium">Current Qty</th>
                      <th className="p-2 text-right font-medium">Current %</th>
                      <th className="p-2 text-right font-medium">Cumulative %</th>
                      <th className="p-2 text-right font-medium">Amount</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">
                          <Input
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Item description"
                            className="min-w-[200px]"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            placeholder="pcs"
                            className="w-16"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.unitRate}
                            onChange={(e) => handleItemChange(index, 'unitRate', e.target.value)}
                            className="w-24 text-right"
                            step="0.01"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.totalQuantity}
                            onChange={(e) => handleItemChange(index, 'totalQuantity', e.target.value)}
                            className="w-20 text-right"
                            step="0.01"
                          />
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {item.previousClaimedPct.toFixed(2)}%
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.currentClaimQty}
                            onChange={(e) => handleItemChange(index, 'currentClaimQty', e.target.value)}
                            className="w-20 text-right"
                            step="0.01"
                            max={item.totalQuantity - item.previousClaimedQty}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.currentClaimPct.toFixed(2)}
                            onChange={(e) => handleItemChange(index, 'currentClaimPct', e.target.value)}
                            className="w-20 text-right"
                            step="0.01"
                            max={100 - item.previousClaimedPct}
                          />
                        </td>
                        <td className="p-2 text-right font-medium">
                          {item.cumulativePct.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatCurrency(item.currentClaimAmount)}
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Claim Amount:</span>
                <span className="font-semibold">{formatCurrency(getTotalClaimAmount())}</span>
              </div>
              {parseFloat(retentionPercentage) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Less Retention ({retentionPercentage}%):</span>
                  <span>- {formatCurrency(getRetentionAmount())}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(getSubTotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({gstRate}%):</span>
                <span className="font-medium">{formatCurrency(getGstAmount())}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Net Amount Payable:</span>
                <span className="text-primary">{formatCurrency(getNetClaimAmount())}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Progress Claim'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
