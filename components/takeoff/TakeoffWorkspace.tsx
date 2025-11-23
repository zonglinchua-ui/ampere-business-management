"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  TakeoffMeasurement,
  TakeoffSheetMetadata,
  TakeoffTool,
} from "@/lib/takeoff/loaders";
import { useTakeoffMeasurements } from "@/hooks/useTakeoffMeasurements";
import {
  Loader2,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
} from "lucide-react";

interface TakeoffWorkspaceProps {
  tenderId: string;
  sheets: TakeoffSheetMetadata[];
  initialMeasurements: TakeoffMeasurement[];
}

interface InteractionState {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (value: number) => void;
  setPan: (value: { x: number; y: number }) => void;
}

const InteractionContext = createContext<InteractionState | undefined>(undefined);

function TakeoffInteractionProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const value = useMemo(
    () => ({
      zoom,
      pan,
      setZoom,
      setPan,
    }),
    [zoom, pan]
  );

  return (
    <InteractionContext.Provider value={value}>
      {children}
    </InteractionContext.Provider>
  );
}

function useTakeoffInteraction() {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error("useTakeoffInteraction must be used within its provider");
  }
  return context;
}

interface ToolState {
  activeTool: TakeoffTool;
  setActiveTool: (tool: TakeoffTool) => void;
}

const ToolContext = createContext<ToolState | undefined>(undefined);

function TakeoffToolProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<TakeoffTool>("select");
  const value = useMemo(() => ({ activeTool, setActiveTool }), [activeTool]);

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

function useTakeoffTool() {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error("useTakeoffTool must be used within its provider");
  }
  return context;
}

export function TakeoffWorkspace({
  tenderId,
  sheets,
  initialMeasurements,
}: TakeoffWorkspaceProps) {
  const [activeSheetId, setActiveSheetId] = useState(
    sheets[0]?.id ?? ""
  );
  const { measurements, isLoading, error, refresh } = useTakeoffMeasurements({
    tenderId,
    initialMeasurements,
  });
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId);
  const sheetMeasurements = measurements.filter(
    (measurement) => measurement.sheetId === activeSheetId
  );

  return (
    <TakeoffInteractionProvider>
      <TakeoffToolProvider>
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3 space-y-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sheets</p>
                <p className="text-xs text-muted-foreground">
                  Select a sheet to start measuring
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={refresh}>
                Refresh
              </Button>
            </div>
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-2">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setActiveSheetId(sheet.id)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition",
                      activeSheetId === sheet.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{sheet.name}</p>
                        {sheet.pageNumber ? (
                          <p className="text-xs text-muted-foreground">
                            Page {sheet.pageNumber}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary">
                        {measurements.filter((m) => m.sheetId === sheet.id).length} measurements
                      </Badge>
                    </div>
                    {sheet.updatedAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date(sheet.updatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </button>
                ))}
                {!sheets.length && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No sheets found for this tender yet.
                  </div>
                )}
              </div>
            </ScrollArea>
            {error ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </aside>

          <section className="lg:col-span-9 space-y-4">
            <WorkspaceToolbar />
            <CanvasArea sheet={activeSheet} isLoading={isLoading} />
            <MeasurementPanel
              measurements={sheetMeasurements}
              isLoading={isLoading}
            />
          </section>
        </div>
      </TakeoffToolProvider>
    </TakeoffInteractionProvider>
  );
}

function WorkspaceToolbar() {
  const { zoom, setZoom, setPan } = useTakeoffInteraction();
  const { activeTool, setActiveTool } = useTakeoffTool();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ToolButton
          label="Select"
          icon={<MousePointer2 className="h-4 w-4" />}
          active={activeTool === "select"}
          onClick={() => setActiveTool("select")}
        />
        <ToolButton
          label="Measure"
          icon={<Ruler className="h-4 w-4" />}
          active={activeTool === "measure"}
          onClick={() => setActiveTool("measure")}
        />
        <ToolButton
          label="Markup"
          icon={<Maximize2 className="h-4 w-4" />}
          active={activeTool === "markup"}
          onClick={() => setActiveTool("markup")}
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.max(0.5, Number((zoom - 0.1).toFixed(2))))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center font-medium">{Math.round(zoom * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.min(4, Number((zoom + 0.1).toFixed(2))))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setPan({ x: 0, y: 0 })}>
          Reset view
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      className="gap-2"
      size="sm"
      onClick={onClick}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </Button>
  );
}

function CanvasArea({
  sheet,
  isLoading,
}: {
  sheet?: TakeoffSheetMetadata;
  isLoading: boolean;
}) {
  const { zoom, pan } = useTakeoffInteraction();

  return (
    <div className="relative overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">{sheet?.name ?? "No sheet selected"}</p>
          <p className="text-xs text-muted-foreground">
            {sheet?.fileUrl ?? "Upload a drawing to start takeoff"}
          </p>
        </div>
        <Badge variant="outline">{Math.round(zoom * 100)}% zoom</Badge>
      </div>
      <div className="relative h-[520px] bg-muted/40">
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sheet data...
            </div>
          ) : sheet ? (
            <div className="text-center">
              <p className="font-medium">PDF viewport placeholder</p>
              <p className="text-xs text-muted-foreground">
                {sheet.name} — ready for measurements and annotations
              </p>
            </div>
          ) : (
            <p>Select a sheet from the sidebar to begin.</p>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

function MeasurementPanel({
  measurements,
  isLoading,
}: {
  measurements: TakeoffMeasurement[];
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Measurements</p>
          <p className="text-xs text-muted-foreground">
            Measurements captured on the active sheet
          </p>
        </div>
        <Badge variant="secondary">{measurements.length} items</Badge>
      </div>
      <Separator className="my-3" />
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing measurements...
        </div>
      ) : measurements.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {measurements.map((measurement) => (
            <div
              key={measurement.id}
              className="rounded-md border p-3 transition hover:border-primary/50"
            >
              <p className="font-medium text-sm">{measurement.label}</p>
              <p className="text-xs text-muted-foreground">
                {measurement.value
                  ? `${measurement.value} ${measurement.unit ?? ""}`
                  : "No value recorded"}
              </p>
              {measurement.annotation ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {measurement.annotation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Measurements will appear here after you add them on the sheet.
        </div>
      )}
    </div>
  );
}
