import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: List all supplier budget items for a project
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

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

    // Get all supplier budget items
    const budgetItems = await prisma.supplierBudgetItem.findMany({
      where: { projectId },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        PurchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get budget summary
    const summary = await prisma.projectBudgetSummary.findUnique({
      where: { projectId },
    });

    // Calculate totals if summary doesn't exist
    const totalQuoted = budgetItems.reduce(
      (sum: any, item: any) => sum + Number(item.quotedAmount),
      0
    );
    const totalActual = budgetItems.reduce(
      (sum: any, item: any) => sum + Number(item.actualCost),
      0
    );

    return NextResponse.json({
      budgetItems,
      summary: summary || {
        totalBudget: totalQuoted,
        totalActualCost: totalActual,
        totalSuppliers: budgetItems.length,
        suppliersWithQuotation: budgetItems.filter((i: any) => i.quotationFilePath)
          .length,
        suppliersWithPO: budgetItems.filter((i: any) => i.poIssued).length,
      },
    });
  } catch (error) {
    console.error("Get supplier budget items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget items" },
      { status: 500 }
    );
  }
}

// POST: Create a new supplier budget item (manual entry)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

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

    const body = await req.json();
    const {
      supplierId,
      tradeType,
      description,
      quotedAmount,
      quotedAmountBeforeTax,
      quotedTaxAmount,
      quotationReference,
      quotationDate,
      notes,
    } = body;

    // Validate required fields
    if (!supplierId || !tradeType || quotedAmount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Create budget item
    const budgetItem = await prisma.supplierBudgetItem.create({
      data: {
        projectId,
        supplierId,
        supplierName: supplier.name,
        tradeType,
        description: description || `${tradeType} - ${supplier.name}`,
        quotedAmount: parseFloat(quotedAmount),
        quotedAmountBeforeTax: quotedAmountBeforeTax
          ? parseFloat(quotedAmountBeforeTax)
          : null,
        quotedTaxAmount: quotedTaxAmount ? parseFloat(quotedTaxAmount) : null,
        quotationReference: quotationReference || null,
        quotationDate: quotationDate ? new Date(quotationDate) : null,
        notes: notes || null,
        status: "QUOTED",
        extractedByAI: false,
        createdById: session.user.id,
      },
      include: {
        Supplier: true,
        CreatedBy: {
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
    console.error("Create supplier budget item error:", error);
    return NextResponse.json(
      { error: "Failed to create budget item" },
      { status: 500 }
    );
  }
}

// Helper functions (same as in upload-quotation route)
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
