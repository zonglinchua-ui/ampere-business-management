-- Add formula support to cost mappings
ALTER TABLE "CostMapping"
  ADD COLUMN "formulaExpression" TEXT,
  ADD COLUMN "formulaInputs" JSONB,
  ADD COLUMN "formulaOutputUnit" "MeasurementUnit",
  ADD COLUMN "derivedValue" DECIMAL(18,4),
  ADD COLUMN "derivedUnit" "MeasurementUnit",
  ADD COLUMN "formulaError" TEXT;
