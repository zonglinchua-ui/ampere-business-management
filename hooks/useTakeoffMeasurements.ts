"use client";

import { useCallback, useEffect, useState } from "react";
import { TakeoffMeasurement } from "@/lib/takeoff/loaders";

interface UseTakeoffMeasurementsOptions {
  tenderId: string;
  initialMeasurements?: TakeoffMeasurement[];
}

export function useTakeoffMeasurements({
  tenderId,
  initialMeasurements = [],
}: UseTakeoffMeasurementsOptions) {
  const [measurements, setMeasurements] = useState<TakeoffMeasurement[]>(
    initialMeasurements
  );
  const [isLoading, setIsLoading] = useState(!initialMeasurements.length);
  const [error, setError] = useState<string | null>(null);

  const loadMeasurements = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/tenders/${tenderId}/takeoff/measurements`,
          {
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load measurements: ${response.statusText}`);
        }

        const payload = await response.json();
        setMeasurements(payload.measurements ?? payload ?? []);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("[takeoff] Failed to load measurements", err);
        setError("Unable to load the latest measurements");
      } finally {
        setIsLoading(false);
      }
    },
    [tenderId]
  );

  useEffect(() => {
    setMeasurements(initialMeasurements);
  }, [initialMeasurements]);

  useEffect(() => {
    const controller = new AbortController();
    loadMeasurements(controller.signal);
    return () => controller.abort();
  }, [loadMeasurements]);

  return {
    measurements,
    isLoading,
    error,
    refresh: () => loadMeasurements(),
  };
}
