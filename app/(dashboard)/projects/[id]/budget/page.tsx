"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CommentThread } from "@/components/comments/CommentThread";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle,
  Upload,
  Plus,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import UploadQuotationDialog from "./components/UploadQuotationDialog";
import AddSupplierBudgetDialog from "./components/AddSupplierBudgetDialog";
import EditSupplierBudgetDialog from "./components/EditSupplierBudgetDialog";

interface SupplierBudgetItem {
  id: string;
  supplierName: string;
  tradeType: string;
  quotedAmount: number;
  actualCost: number;
  variance: number | null;
  variancePercentage: number | null;
  status: string;
  quotationReference: string | null;
  quotationFilePath: string | null;
  poIssued: boolean;
  needsReview: boolean;
  isApproved: boolean;
  Supplier: {
    id: string;
    name: string;
  };
  PurchaseOrder: {
    id: string;
    poNumber: string;
    status: string;
  } | null;
}

interface BudgetSummary {
  contractValue: number;
  totalBudget: number;
  totalActualCost: number;
  estimatedProfit: number;
  estimatedProfitMargin: number;
  actualProfit: number;
  actualProfitMargin: number;
  budgetUtilization: number;
  costUtilization: number;
  totalSuppliers: number;
  suppliersWithQuotation: number;
  suppliersWithPO: number;
  hasWarnings: boolean;
  warningCount: number;
  criticalWarningCount: number;
}

export default function ProjectBudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [budgetItems, setBudgetItems] = useState<SupplierBudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupplierBudgetItem | null>(
    null
  );

  useEffect(() => {
    fetchBudgetData();
  }, [projectId]);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/budget/supplier-items`
      );
      if (response.ok) {
        const data = await response.json();
        setBudgetItems(data.budgetItems || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch budget data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item: SupplierBudgetItem) => {
    setSelectedItem(item);
    setEditDialogOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this budget item?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/budget/supplier-items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchBudgetData();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete budget item");
      }
    } catch (error) {
      console.error("Failed to delete budget item:", error);
      alert("Failed to delete budget item");
    }
  };

  const handleIssuePO = async (itemId: string) => {
    if (
      !confirm(
        "Issue a Purchase Order for this budget item? This will create a PO linked to this quotation."
      )
    )
      return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/budget/supplier-items/${itemId}/issue-po`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliveryDate: null,
            deliveryAddress: "",
            terms: null,
            notes: "",
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(
          data.message ||
            `Purchase Order ${data.purchaseOrder?.poNumber} created successfully!`
        );
        fetchBudgetData();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to issue Purchase Order");
      }
    } catch (error) {
      console.error("Failed to issue PO:", error);
      alert("Failed to issue Purchase Order");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      QUOTED: "bg-blue-100 text-blue-800",
      PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      PO_ISSUED: "bg-purple-100 text-purple-800",
      IN_PROGRESS: "bg-indigo-100 text-indigo-800",
      COMPLETED: "bg-teal-100 text-teal-800",
      INVOICED: "bg-orange-100 text-orange-800",
      PAID: "bg-emerald-100 text-emerald-800",
      CANCELLED: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading budget data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Budget</h1>
          <p className="text-gray-500 mt-1">
            Manage supplier budgets, quotations, and track profit/loss
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Quotation
          </Button>
          <Button
            onClick={() => setAddDialogOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Manual Entry
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {summary?.hasWarnings && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Budget Warnings</AlertTitle>
          <AlertDescription>
            {summary.criticalWarningCount > 0 && (
              <span className="font-semibold">
                {summary.criticalWarningCount} critical warning(s).{" "}
              </span>
            )}
            {summary.warningCount > 0 && (
              <span>{summary.warningCount} warning(s).</span>
            )}
            {" "}Please review your budget allocations.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contract Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Contract Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.contractValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Project revenue</p>
          </CardContent>
        </Card>

        {/* Total Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalBudget || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.budgetUtilization.toFixed(1)}% of contract
            </p>
            <Progress
              value={summary?.budgetUtilization || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Estimated Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated Profit
            </CardTitle>
            {(summary?.estimatedProfit || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (summary?.estimatedProfit || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(summary?.estimatedProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.estimatedProfitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        {/* Suppliers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalSuppliers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.suppliersWithQuotation || 0} with quotations,{" "}
              {summary?.suppliersWithPO || 0} with PO
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actual Cost & Profit (if any costs recorded) */}
      {summary && summary.totalActualCost > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Actual Cost
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalActualCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.costUtilization?.toFixed(1)}% of contract
              </p>
              <Progress value={summary.costUtilization || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Actual Profit
              </CardTitle>
              {(summary.actualProfit || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  (summary.actualProfit || 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(summary.actualProfit || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.actualProfitMargin?.toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variance</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalBudget - summary.totalActualCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                Budget vs. Actual
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier Budget Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Budget Items</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No budget items
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading a quotation or adding a manual entry.
              </p>
              <div className="mt-6 flex gap-2 justify-center">
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Quotation
                </Button>
                <Button
                  onClick={() => setAddDialogOpen(true)}
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manual Entry
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Trade Type</TableHead>
                  <TableHead>Quoted Amount</TableHead>
                  <TableHead>Actual Cost</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.needsReview && (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        {item.isApproved && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">
                          {item.supplierName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{item.tradeType}</TableCell>
                    <TableCell>{formatCurrency(item.quotedAmount)}</TableCell>
                    <TableCell>{formatCurrency(item.actualCost)}</TableCell>
                    <TableCell>
                      {item.variance !== null ? (
                        <span
                          className={
                            item.variance >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {formatCurrency(item.variance)}
                          {item.variancePercentage !== null && (
                            <span className="text-xs ml-1">
                              ({item.variancePercentage.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      {item.poIssued ? (
                        <Badge className="bg-purple-100 text-purple-800">
                          {item.PurchaseOrder?.poNumber || "Issued"}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {!item.poIssued && item.isApproved && (
                          <Button
                            size="sm"
                            onClick={() => handleIssuePO(item.id)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <FileCheck className="w-4 h-4 mr-1" />
                            Issue PO
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditItem(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={item.poIssued}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      )}
    </CardContent>
  </Card>

  <CommentThread entityId={projectId} entityType="PROJECT_BUDGET" />

  {/* Dialogs */}
  <UploadQuotationDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={projectId}
        onSuccess={fetchBudgetData}
      />

      <AddSupplierBudgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        projectId={projectId}
        onSuccess={fetchBudgetData}
      />

      {selectedItem && (
        <EditSupplierBudgetDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          projectId={projectId}
          budgetItem={selectedItem}
          onSuccess={fetchBudgetData}
        />
      )}
    </div>
  );
}
