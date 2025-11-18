import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { extractTextFromPDF, cleanPDFText, extractQuotationPatterns } from "@/lib/pdf-extraction";
import { extractQuotationWithOllama, QuotationExtraction } from "@/lib/ollama-quotation-extractor";

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
      include: {
        ProjectUser: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (
      project.ProjectUser.length === 0 &&
      session.user.role !== "SUPERADMIN"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const supplierId = formData.get("supplierId") as string;
    const tradeType = formData.get("tradeType") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!supplierId) {
      return NextResponse.json(
        { error: "Supplier ID is required" },
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

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and image files are allowed" },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), "uploads", "quotations", projectId);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = join(uploadDir, fileName);
    const relativeFilePath = `/uploads/quotations/${projectId}/${fileName}`;

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Extract text from PDF/image
    let extractedData: QuotationExtraction | null = null;
    let aiConfidence = 0;
    let needsReview = true;

    try {
      let pdfText = '';

      if (file.type === 'application/pdf') {
        // Extract text from PDF
        const pdfResult = await extractTextFromPDF(filePath);
        
        if (pdfResult.success && pdfResult.text) {
          pdfText = cleanPDFText(pdfResult.text);
        } else {
          throw new Error('Failed to extract text from PDF');
        }
      } else {
        // For images, we'll need OCR - for now, return error
        return NextResponse.json(
          { error: "Image quotations not yet supported. Please upload PDF files." },
          { status: 400 }
        );
      }

      // First, try pattern-based extraction for quick wins
      const patterns = extractQuotationPatterns(pdfText);

      // Then use Ollama for structured extraction
      const ollamaResult = await extractQuotationWithOllama(pdfText, supplier.name);

      // Merge pattern-based and Ollama results (Ollama takes precedence)
      extractedData = {
        supplierName: ollamaResult.supplierName || supplier.name,
        quotationReference: ollamaResult.quotationReference || patterns.quotationNumber || "",
        quotationDate: ollamaResult.quotationDate || new Date().toISOString(),
        totalAmount: ollamaResult.totalAmount || parseFloat(patterns.totalAmount) || 0,
        amountBeforeTax: ollamaResult.amountBeforeTax || parseFloat(patterns.subtotal),
        taxAmount: ollamaResult.taxAmount || parseFloat(patterns.tax),
        currency: ollamaResult.currency || "SGD",
        tradeType: ollamaResult.tradeType || tradeType || "General",
        lineItems: ollamaResult.lineItems || [],
        confidence: ollamaResult.confidence,
        rawText: pdfText.substring(0, 500),
      };

      aiConfidence = extractedData.confidence;
      
      // Need review if confidence is low or total amount is 0
      needsReview = aiConfidence < 0.7 || extractedData.totalAmount === 0;

    } catch (aiError) {
      console.error("AI extraction error:", aiError);
      // Continue without AI extraction
      extractedData = {
        supplierName: supplier.name,
        quotationReference: "",
        quotationDate: new Date().toISOString(),
        totalAmount: 0,
        currency: "SGD",
        tradeType: tradeType || "General",
        confidence: 0,
      };
      needsReview = true;
    }

    // Create SupplierBudgetItem with extracted data
    const budgetItem = await prisma.supplierBudgetItem.create({
      data: {
        projectId,
        supplierId,
        supplierName: supplier.name,
        tradeType: extractedData?.tradeType || tradeType || "General",
        description: `Quotation from ${supplier.name}`,
        quotedAmount: extractedData?.totalAmount || 0,
        quotedAmountBeforeTax: extractedData?.amountBeforeTax,
        quotedTaxAmount: extractedData?.taxAmount,
        quotationReference: extractedData?.quotationReference,
        quotationDate: extractedData?.quotationDate
          ? new Date(extractedData.quotationDate)
          : new Date(),
        quotationFilePath: relativeFilePath,
        quotationFileName: file.name,
        extractedByAI: true,
        aiConfidence: aiConfidence,
        aiExtractedData: extractedData as any,
        needsReview,
        status: needsReview ? "PENDING_APPROVAL" : "QUOTED",
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
      extractedData,
      needsReview,
      message: needsReview
        ? "Quotation uploaded. Please review and confirm the extracted data."
        : "Quotation uploaded and processed successfully.",
    });
  } catch (error) {
    console.error("Upload quotation error:", error);
    return NextResponse.json(
      { error: "Failed to upload quotation" },
      { status: 500 }
    );
  }
}

// Helper function to update project budget summary
async function updateProjectBudgetSummary(projectId: string) {
  // Get all supplier budget items
  const budgetItems = await prisma.supplierBudgetItem.findMany({
    where: { projectId },
  });

  const totalBudget = budgetItems.reduce(
    (sum, item) => sum + Number(item.quotedAmount),
    0
  );
  const totalActualCost = budgetItems.reduce(
    (sum, item) => sum + Number(item.actualCost),
    0
  );
  const suppliersWithQuotation = budgetItems.filter(
    (item) => item.quotationFilePath
  ).length;
  const suppliersWithPO = budgetItems.filter((item) => item.poIssued).length;

  // Get project contract value
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

  // Upsert budget summary
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

// Helper function to check budget warnings
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

  // Check if budget exceeds contract
  if (Number(summary.totalBudget) > Number(summary.contractValue)) {
    warnings.push({
      type: "BUDGET_EXCEEDED",
      severity: "CRITICAL",
      title: "Budget Exceeds Contract Value",
      message: `Total supplier budgets (${summary.totalBudget}) exceed contract value (${summary.contractValue})`,
    });
  }

  // Check if budget approaching contract (>90%)
  if (Number(summary.budgetUtilization) > 90) {
    warnings.push({
      type: "BUDGET_WARNING",
      severity: "WARNING",
      title: "Budget Approaching Contract Value",
      message: `Budget utilization is at ${summary.budgetUtilization.toFixed(1)}%`,
    });
  }

  // Check for negative profit
  if (Number(summary.estimatedProfit) < 0) {
    warnings.push({
      type: "PROFIT_LOSS",
      severity: "CRITICAL",
      title: "Project Showing Loss",
      message: `Estimated loss: ${Math.abs(Number(summary.estimatedProfit)).toFixed(2)}`,
    });
  }

  // Check for low profit margin (<10%)
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

  // Create alerts for new warnings
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

  // Update summary warning counts
  await prisma.projectBudgetSummary.update({
    where: { projectId },
    data: {
      hasWarnings: warnings.length > 0,
      warningCount: warnings.filter((w) => w.severity === "WARNING").length,
      criticalWarningCount: warnings.filter((w) => w.severity === "CRITICAL")
        .length,
    },
  });
}
