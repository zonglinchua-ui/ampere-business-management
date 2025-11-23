import { unstable_noStore as noStore } from "next/cache";

export type TakeoffTool = "select" | "measure" | "markup";

export interface TakeoffSheetMetadata {
  id: string;
  name: string;
  pageNumber?: number;
  fileUrl: string;
  updatedAt?: string;
}

export interface TakeoffMeasurement {
  id: string;
  sheetId: string;
  label: string;
  value?: number;
  unit?: string;
  annotation?: string;
  geometry?: Record<string, unknown>;
}

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 0 } });
    if (!response.ok) {
      console.error(`[takeoff] Failed to fetch ${url}: ${response.statusText}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[takeoff] Error fetching ${url}:`, error);
    return null;
  }
}

export async function fetchTakeoffSheets(
  tenderId: string
): Promise<TakeoffSheetMetadata[]> {
  noStore();
  const baseUrl = getBaseUrl();
  const result = await fetchJson<{ sheets?: TakeoffSheetMetadata[] }>(
    `${baseUrl}/api/tenders/${tenderId}/takeoff/sheets`
  );

  if (result?.sheets) {
    return result.sheets;
  }

  // Fallback to empty array to keep workspace rendering if API is unavailable
  return [];
}

export async function fetchInitialMeasurements(
  tenderId: string
): Promise<TakeoffMeasurement[]> {
  noStore();
  const baseUrl = getBaseUrl();
  const result = await fetchJson<{ measurements?: TakeoffMeasurement[] }>(
    `${baseUrl}/api/tenders/${tenderId}/takeoff/measurements`
  );

  if (result?.measurements) {
    return result.measurements;
  }

  return [];
}
