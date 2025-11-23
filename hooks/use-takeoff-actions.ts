"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  approveDetection,
  deleteMeasurement,
  MeasurementDTO,
  MeasurementPayload,
  rejectDetection,
  saveMeasurement,
  listMeasurements,
  SaveMeasurementInput,
  DeleteMeasurementInput,
} from "@/lib/takeoff/actions"

const measurementQueryKey = (tenderId: string, planSheetId: string) => [
  "takeoff-measurements",
  tenderId,
  planSheetId,
]

function recomputeRollup(measurements: MeasurementDTO[]) {
  const rollupMap = new Map<string, { measurementType: string; unit: string; total: number; count: number }>()

  measurements.forEach((measurement) => {
    const key = `${measurement.measurementType}:${measurement.unit}`
    const existing = rollupMap.get(key)

    if (existing) {
      existing.total += measurement.value
      existing.count += 1
    } else {
      rollupMap.set(key, {
        measurementType: measurement.measurementType,
        unit: measurement.unit,
        total: measurement.value,
        count: 1,
      })
    }
  })

  return Array.from(rollupMap.values())
}

export function useMeasurements(tenderId: string, planSheetId?: string) {
  const queryKey = measurementQueryKey(tenderId, planSheetId ?? "")

  return useQuery({
    queryKey,
    queryFn: () => listMeasurements({ tenderId, planSheetId: planSheetId! }),
    enabled: Boolean(tenderId && planSheetId),
  })
}

export function useSaveMeasurement(tenderId: string, planSheetId: string) {
  const queryClient = useQueryClient()
  const queryKey = measurementQueryKey(tenderId, planSheetId)

  return useMutation({
    mutationFn: (input: Omit<SaveMeasurementInput, "tenderId" | "planSheetId"> & { measurementId?: string }) =>
      saveMeasurement({ ...input, tenderId, planSheetId }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<MeasurementPayload>(queryKey)

      if (!previous) {
        return { previous }
      }

      const optimisticMeasurement: MeasurementDTO = {
        id: input.measurementId ?? `temp-${Date.now()}`,
        planSheetId,
        detectedElementId: input.detectedElementId ?? null,
        measurementType: input.measurementType,
        unit: input.unit,
        value: input.value,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const updatedMeasurements = input.measurementId
        ? previous.measurements.map((measurement) =>
            measurement.id === input.measurementId ? optimisticMeasurement : measurement,
          )
        : [optimisticMeasurement, ...previous.measurements]

      queryClient.setQueryData<MeasurementPayload>(queryKey, {
        measurements: updatedMeasurements,
        rollup: recomputeRollup(updatedMeasurements),
      })

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
  })
}

export function useDeleteMeasurement(tenderId: string, planSheetId: string) {
  const queryClient = useQueryClient()
  const queryKey = measurementQueryKey(tenderId, planSheetId)

  return useMutation({
    mutationFn: (input: Omit<DeleteMeasurementInput, "tenderId" | "planSheetId">) =>
      deleteMeasurement({ ...input, tenderId, planSheetId }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<MeasurementPayload>(queryKey)

      if (!previous) {
        return { previous }
      }

      const updatedMeasurements = previous.measurements.filter(
        (measurement) => measurement.id !== input.measurementId,
      )

      queryClient.setQueryData<MeasurementPayload>(queryKey, {
        measurements: updatedMeasurements,
        rollup: recomputeRollup(updatedMeasurements),
      })

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
  })
}

export function useApproveDetection(tenderId: string, planSheetId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (detectionId: string) =>
      approveDetection({ tenderId, planSheetId, detectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementQueryKey(tenderId, planSheetId) })
    },
  })
}

export function useRejectDetection(tenderId: string, planSheetId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (detectionId: string) =>
      rejectDetection({ tenderId, planSheetId, detectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementQueryKey(tenderId, planSheetId) })
    },
  })
}
