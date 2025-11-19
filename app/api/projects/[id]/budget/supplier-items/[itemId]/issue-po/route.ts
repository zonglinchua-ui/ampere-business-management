import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDefaultPOTerms } from "@/lib/po-default-terms";

// POST: Issue a Purchase Order from a supplier budget item
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, itemId } = params;

    // Check permissions
    const userRole = session.user.role;
    const canCreatePO = ["SUPERADMIN", "PROJECT_MANAGER"].includes(
      userRole || ""
    );

    if (!canCreatePO) {
      return NextResponse.json(
        { error: "Insufficient permissions to create PO" },
        { status: 403 }
      );
    }

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        createdById: true,
        managerId: true,
        salespersonId: true,
        contractValue: true,
        address: true,
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
      },
    });

    if (!budgetItem || budgetItem.projectId !== projectId) {
      return NextResponse.json(
        { error: "Budget item not found" },
        { status: 404 }
      );
    }

    // Check if PO already issued
    if (budgetItem.poIssued) {
      return NextResponse.json(
        {
          error: "PO already issued for this budget item",
          purchaseOrderId: budgetItem.purchaseOrderId,
        },
        { status: 400 }
      );
    }

    // Check if budget item is approved
    if (!budgetItem.isApproved) {
      return NextResponse.json(
        { error: "Budget item must be approved before issuing PO" },
        { status: 400 }
      );
    }

    // Get request body for additional PO details
    const body = await req.json();
    const {
      deliveryDate,
      deliveryAddress,
      terms,
      notes,
      items, // Optional: detailed line items
    } = body;

    // Generate PO number
    const currentYear = new Date().getFullYear();
    const yearPrefix = currentYear.toString();

    const lastPO = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber: {
          contains: yearPrefix,
        },
      },
      orderBy: {
        poNumber: "desc",
      },
    });

    let nextNumber = 1;
    if (lastPO) {
      const match = lastPO.poNumber.match(/PO-(\d+)-/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const vendorCode =
      budgetItem.Supplier.name
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, "") || "GEN";
    const poNumber = `PO-${nextNumber.toString().padStart(3, "0")}-${vendorCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

    // Calculate amounts
    const subtotal = Number(budgetItem.quotedAmountBeforeTax || budgetItem.quotedAmount);
    const taxAmount = Number(budgetItem.quotedTaxAmount || 0);
    const totalAmount = Number(budgetItem.quotedAmount);

    // Create PO in transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Create the purchase order
      const po = await tx.purchaseOrder.create({
        data: {
          id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          poNumber,
          type: "OUTGOING",
          supplierId: budgetItem.supplierId,
          projectId: projectId,
          requesterId: session.user.id,
          subtotal,
          taxAmount,
          totalAmount,
          currency: "SGD",
          status: "ISSUED",
          issueDate: new Date(),
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          deliveryAddress: deliveryAddress || project.address || "",
          terms: terms || getDefaultPOTerms(),
          notes: notes || `PO for ${budgetItem.tradeType} - ${budgetItem.description || ""}`,
          createdById: session.user.id,
          updatedAt: new Date(),
        },
      });

      // Create purchase order items
      if (items && items.length > 0) {
        // Use provided detailed items
        await tx.purchaseOrderItem.createMany({
          data: items.map((item: any, index: number) => ({
            id: `${po.id}_item_${index + 1}`,
            purchaseOrderId: po.id,
            description: item.description,
            category: item.category || "MATERIALS",
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            discount: item.discount || 0,
            taxRate: item.taxRate || 9,
            subtotal: item.subtotal || 0,
            discountAmount: item.discountAmount || 0,
            taxAmount: item.taxAmount || 0,
            totalPrice: item.totalPrice || 0,
            unit: item.unit || "pcs",
            notes: item.notes || "",
            order: item.order || index + 1,
          })),
        });
      } else {
        // Create a single line item from budget item
        await tx.purchaseOrderItem.create({
          data: {
            id: `${po.id}_item_1`,
            purchaseOrderId: po.id,
            description:
              budgetItem.description ||
              `${budgetItem.tradeType} - ${budgetItem.supplierName}`,
            category: "MATERIALS",
            quantity: 1,
            unitPrice: subtotal,
            discount: 0,
            taxRate: taxAmount > 0 ? (taxAmount / subtotal) * 100 : 0,
            subtotal: subtotal,
            discountAmount: 0,
            taxAmount: taxAmount,
            totalPrice: totalAmount,
            unit: "lot",
            notes: budgetItem.quotationReference
              ? `Quotation Ref: ${budgetItem.quotationReference}`
              : "",
            order: 1,
          },
        });
      }

      // Log activity
      await tx.purchaseOrderActivity.create({
        data: {
          id: `${po.id}_activity_created`,
          purchaseOrderId: po.id,
          action: "CREATED",
          description: `PO created from budget quotation by ${session.user.firstName} ${session.user.lastName}`,
          userId: session.user.id,
          userEmail: session.user.email || "",
        },
      });

      // Update budget item to link PO
      await tx.supplierBudgetItem.update({
        where: { id: itemId },
        data: {
          purchaseOrderId: po.id,
          poIssued: true,
          poIssuedDate: new Date(),
          status: "PO_ISSUED",
        },
      });

      return po;
    });

    // Fetch full PO data with relationships
    const fullPO = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrder.id },
      include: {
        Supplier: true,
        Project: true,
        PurchaseOrderItem: true,
        User_PurchaseOrder_requesterIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update project budget summary
    await updateProjectBudgetSummary(projectId);

    return NextResponse.json({
      success: true,
      purchaseOrder: fullPO,
      message: `Purchase Order ${poNumber} created successfully`,
    });
  } catch (error) {
    console.error("Issue PO from budget error:", error);
    return NextResponse.json(
      { error: "Failed to issue Purchase Order" },
      { status: 500 }
    );
  }
}

// Helper function to update project budget summary
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
  const suppliersWithPO = budgetItems.filter((item) => item.poIssued).length;

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
