import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Get a single supplier budget item
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, itemId } = params;

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        createdById: true,
        managerId: true,
        salespersonId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user has access
    const hasAccess =
      session.user.role === "SUPERADMIN" ||
      session.user.role === "PROJECT_MANAGER" ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id ||
      project.salespersonId === session.user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get budget item
    const budgetItem = await prisma.supplierBudgetItem.findUnique({
      where: { id: itemId },
      include: {
        Supplier: true,
        PurchaseOrder: {
          include: {
            PurchaseOrderItem: true,
          },
        },
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ApprovedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!budgetItem || budgetItem.projectId !== projectId) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ budgetItem });
  } catch (error) {
    console.error("Get supplier budget item error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget item" },
      { status: 500 }
    );
  }
}

// PUT: Update a supplier budget item
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, itemId } = params;

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        createdById: true,
        managerId: true,
        salespersonId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user has access
    const hasAccess =
      session.user.role === "SUPERADMIN" ||
      session.user.role === "PROJECT_MANAGER" ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id ||
      project.salespersonId === session.user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get existing budget item
    const existingItem = await prisma.supplierBudgetItem.findUnique({
      where: { id: itemId },
    });

    if (!existingItem || existingItem.projectId !== projectId) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      tradeType,
      description,
      quotedAmount,
      quotedAmountBeforeTax,
      quotedTaxAmount,
      quotationReference,
      quotationDate,
      actualCost,
      actualCostBeforeTax,
      actualTaxAmount,
      status,
      isApproved,
      notes,
      internalNotes,
    } = body;

    // Calculate variance if both quoted and actual amounts are provided
    let variance = null;
    let variancePercentage = null;
    if (actualCost !== undefined && quotedAmount !== undefined) {
      variance = parseFloat(quotedAmount) - parseFloat(actualCost);
      variancePercentage =
        parseFloat(quotedAmount) > 0
          ? (variance / parseFloat(quotedAmount)) * 100
          : 0;
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (tradeType !== undefined) updateData.tradeType = tradeType;
    if (description !== undefined) updateData.description = description;
    if (quotedAmount !== undefined)
      updateData.quotedAmount = parseFloat(quotedAmount);
    if (quotedAmountBeforeTax !== undefined)
      updateData.quotedAmountBeforeTax = quotedAmountBeforeTax
        ? parseFloat(quotedAmountBeforeTax)
        : null;
    if (quotedTaxAmount !== undefined)
      updateData.quotedTaxAmount = quotedTaxAmount
        ? parseFloat(quotedTaxAmount)
        : null;
    if (quotationReference !== undefined)
      updateData.quotationReference = quotationReference;
    if (quotationDate !== undefined)
      updateData.quotationDate = quotationDate ? new Date(quotationDate) : null;
    if (actualCost !== undefined)
      updateData.actualCost = parseFloat(actualCost);
    if (actualCostBeforeTax !== undefined)
      updateData.actualCostBeforeTax = actualCostBeforeTax
        ? parseFloat(actualCostBeforeTax)
        : null;
    if (actualTaxAmount !== undefined)
      updateData.actualTaxAmount = actualTaxAmount
        ? parseFloat(actualTaxAmount)
        : null;
    if (variance !== null) updateData.variance = variance;
    if (variancePercentage !== null)
      updateData.variancePercentage = variancePercentage;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    // Handle approval
    if (isApproved !== undefined && isApproved && !existingItem.isApproved) {
      updateData.isApproved = true;
      updateData.approvedById = session.user.id;
      updateData.approvedAt = new Date();
      updateData.status = "APPROVED";
      updateData.needsReview = false;
    }

    // Update budget item
    const budgetItem = await prisma.supplierBudgetItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        Supplier: true,
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ApprovedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update project budget summary
    await updateProjectBudgetSummary(projectId);

    // Check for budget warnings
    await checkBudgetWarnings(projectId);

    return NextResponse.json({
      success: true,
      budgetItem,
    });
  } catch (error) {
    console.error("Update supplier budget item error:", error);
    return NextResponse.json(
      { error: "Failed to update budget item" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a supplier budget item
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, itemId } = params;

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        createdById: true,
        managerId: true,
        salespersonId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user has access
    const hasAccess =
      session.user.role === "SUPERADMIN" ||
      session.user.role === "PROJECT_MANAGER" ||
      project.createdById === session.user.id ||
      project.managerId === session.user.id ||
      project.salespersonId === session.user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if budget item exists and belongs to project
    const budgetItem = await prisma.supplierBudgetItem.findUnique({
      where: { id: itemId },
    });

    if (!budgetItem || budgetItem.projectId !== projectId) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    // Check if PO has been issued
    if (budgetItem.poIssued) {
      return NextResponse.json(
        {
          error:
            "Cannot delete budget item with issued PO. Please cancel the PO first.",
        },
        { status: 400 }
      );
    }

    // Delete budget item
    await prisma.supplierBudgetItem.delete({
      where: { id: itemId },
    });

    // Update project budget summary
    await updateProjectBudgetSummary(projectId);

    // Check for budget warnings
    await checkBudgetWarnings(projectId);

    return NextResponse.json({
      success: true,
      message: "Budget item deleted successfully",
    });
  } catch (error) {
    console.error("Delete supplier budget item error:", error);
    return NextResponse.json(
      { error: "Failed to delete budget item" },
      { status: 500 }
    );
  }
}

// Helper functions
async function updateProjectBudgetSummary(projectId: string) {
  const budgetItems = await prisma.supplierBudgetItem.findMany({
    where: { projectId },
  });

  const totalBudget = budgetItems.reduce(
    (sum: any, item: any) => sum + Number(item.quotedAmount),
    0
  );
  const totalActualCost = budgetItems.reduce(
    (sum: any, item: any) => sum + Number(item.actualCost),
    0
  );
  const suppliersWithQuotation = budgetItems.filter(
    (item) => item.quotationFilePath
  ).length;
  const suppliersWithPO = budgetItems.filter((item: any) => item.poIssued).length;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { contractValue: true },
  });

  const contractValue = Number(project?.contractValue || 0);
  const estimatedProfit = contractValue - totalBudget;
  const estimatedProfitMargin =
    contractValue > 0 ? (estimatedProfit / contractValue) * 100 : 0;
  const actualProfit = contractValue - totalActualCost;
  const actualProfitMargin =
    contractValue > 0 ? (actualProfit / contractValue) * 100 : 0;
  const budgetUtilization =
    contractValue > 0 ? (totalBudget / contractValue) * 100 : 0;
  const costUtilization =
    contractValue > 0 ? (totalActualCost / contractValue) * 100 : 0;

  await prisma.projectBudgetSummary.upsert({
    where: { projectId },
    create: {
      projectId,
      contractValue,
      totalBudget,
      totalActualCost,
      estimatedProfit,
      estimatedProfitMargin,
      actualProfit,
      actualProfitMargin,
      budgetUtilization,
      costUtilization,
      totalSuppliers: budgetItems.length,
      suppliersWithQuotation,
      suppliersWithPO,
    },
    update: {
      totalBudget,
      totalActualCost,
      estimatedProfit,
      estimatedProfitMargin,
      actualProfit,
      actualProfitMargin,
      budgetUtilization,
      costUtilization,
      totalSuppliers: budgetItems.length,
      suppliersWithQuotation,
      suppliersWithPO,
      lastCalculatedAt: new Date(),
    },
  });
}

async function checkBudgetWarnings(projectId: string) {
  const summary = await prisma.projectBudgetSummary.findUnique({
    where: { projectId },
  });

  if (!summary) return;

  const warnings: Array<{
    type: string;
    severity: string;
    title: string;
    message: string;
  }> = [];

  if (Number(summary.totalBudget) > Number(summary.contractValue)) {
    warnings.push({
      type: "BUDGET_EXCEEDED",
      severity: "CRITICAL",
      title: "Budget Exceeds Contract Value",
      message: `Total supplier budgets (${summary.totalBudget}) exceed contract value (${summary.contractValue})`,
    });
  }

  if (Number(summary.budgetUtilization) > 90) {
    warnings.push({
      type: "BUDGET_WARNING",
      severity: "WARNING",
      title: "Budget Approaching Contract Value",
      message: `Budget utilization is at ${summary.budgetUtilization.toFixed(1)}%`,
    });
  }

  if (Number(summary.estimatedProfit) < 0) {
    warnings.push({
      type: "PROFIT_LOSS",
      severity: "CRITICAL",
      title: "Project Showing Loss",
      message: `Estimated loss: ${Math.abs(Number(summary.estimatedProfit)).toFixed(2)}`,
    });
  }

  if (
    Number(summary.estimatedProfitMargin) < 10 &&
    Number(summary.estimatedProfitMargin) >= 0
  ) {
    warnings.push({
      type: "PROFIT_WARNING",
      severity: "WARNING",
      title: "Low Profit Margin",
      message: `Profit margin is only ${summary.estimatedProfitMargin.toFixed(1)}%`,
    });
  }

  for (const warning of warnings) {
    await prisma.budgetAlert.create({
      data: {
        projectId,
        alertType: warning.type as any,
        severity: warning.severity as any,
        title: warning.title,
        message: warning.message,
      },
    });
  }

  await prisma.projectBudgetSummary.update({
    where: { projectId },
    data: {
      hasWarnings: warnings.length > 0,
      warningCount: warnings.filter((w: any) => w.severity === "WARNING").length,
      criticalWarningCount: warnings.filter((w: any) => w.severity === "CRITICAL")
        .length,
    },
  });
}
