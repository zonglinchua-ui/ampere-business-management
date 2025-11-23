-- CreateEnum
CREATE TYPE "TakeoffElementType" AS ENUM ('WALL', 'DOOR', 'WINDOW', 'COLUMN', 'BEAM', 'SLAB', 'ROOM', 'GENERIC');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('LINEAR', 'AREA', 'COUNT');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('METER', 'FOOT', 'SQUARE_METER', 'SQUARE_FOOT', 'COUNT', 'ITEM');

-- CreateTable
CREATE TABLE "TenderTakeoffPackage" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderTakeoffPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSheet" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "scaleRatio" TEXT,
    "scaleUnit" "MeasurementUnit",
    "pageNumber" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedElement" (
    "id" TEXT NOT NULL,
    "planSheetId" TEXT NOT NULL,
    "elementType" "TakeoffElementType" NOT NULL,
    "geometry" JSONB,
    "sourceGeometry" JSONB,
    "confidence" DOUBLE PRECISION,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "planSheetId" TEXT NOT NULL,
    "detectedElementId" TEXT,
    "measurementType" "MeasurementType" NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAssembly" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costCodeId" TEXT,
    "unit" "MeasurementUnit",
    "rate" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAssembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostMapping" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "detectedElementId" TEXT,
    "measurementId" TEXT,
    "costCodeId" TEXT,
    "costAssemblyId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCode_code_key" ON "CostCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CostAssembly_code_key" ON "CostAssembly"("code");

-- CreateIndex
CREATE INDEX "TenderTakeoffPackage_tenderId_idx" ON "TenderTakeoffPackage"("tenderId");

-- CreateIndex
CREATE INDEX "TenderTakeoffPackage_projectId_idx" ON "TenderTakeoffPackage"("projectId");

-- CreateIndex
CREATE INDEX "PlanSheet_packageId_idx" ON "PlanSheet"("packageId");

-- CreateIndex
CREATE INDEX "DetectedElement_planSheetId_idx" ON "DetectedElement"("planSheetId");

-- CreateIndex
CREATE INDEX "DetectedElement_elementType_idx" ON "DetectedElement"("elementType");

-- CreateIndex
CREATE INDEX "Measurement_planSheetId_idx" ON "Measurement"("planSheetId");

-- CreateIndex
CREATE INDEX "Measurement_detectedElementId_idx" ON "Measurement"("detectedElementId");

-- CreateIndex
CREATE INDEX "Measurement_measurementType_idx" ON "Measurement"("measurementType");

-- CreateIndex
CREATE INDEX "CostMapping_packageId_idx" ON "CostMapping"("packageId");

-- CreateIndex
CREATE INDEX "CostMapping_detectedElementId_idx" ON "CostMapping"("detectedElementId");

-- CreateIndex
CREATE INDEX "CostMapping_measurementId_idx" ON "CostMapping"("measurementId");

-- CreateIndex
CREATE INDEX "CostMapping_costCodeId_idx" ON "CostMapping"("costCodeId");

-- CreateIndex
CREATE INDEX "CostMapping_costAssemblyId_idx" ON "CostMapping"("costAssemblyId");

-- AddForeignKey
ALTER TABLE "TenderTakeoffPackage" ADD CONSTRAINT "TenderTakeoffPackage_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tend
or"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderTakeoffPackage" ADD CONSTRAINT "TenderTakeoffPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Pro
ject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderTakeoffPackage" ADD CONSTRAINT "TenderTakeoffPackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES 
"User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderTakeoffPackage"("id
") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DEL
ETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedElement" ADD CONSTRAINT "DetectedElement_planSheetId_fkey" FOREIGN KEY ("planSheetId") REFERENCES "PlanSheet
"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_planSheetId_fkey" FOREIGN KEY ("planSheetId") REFERENCES "PlanSheet"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_detectedElementId_fkey" FOREIGN KEY ("detectedElementId") REFERENCES "Detec
tedElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAssembly" ADD CONSTRAINT "CostAssembly_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") O
N DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMapping" ADD CONSTRAINT "CostMapping_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderTakeoffPackage"
("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMapping" ADD CONSTRAINT "CostMapping_detectedElementId_fkey" FOREIGN KEY ("detectedElementId") REFERENCES "Detec
tedElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMapping" ADD CONSTRAINT "CostMapping_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"
("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMapping" ADD CONSTRAINT "CostMapping_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON 
DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMapping" ADD CONSTRAINT "CostMapping_costAssemblyId_fkey" FOREIGN KEY ("costAssemblyId") REFERENCES "CostAssembl
y"("id") ON DELETE SET NULL ON UPDATE CASCADE;
