'use client';

import type {
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  WheelEvent
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { Document, Page } from 'react-pdf';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export type OverlayTransform = {
  offset: { x: number; y: number };
  scale: number;
  zoom: number;
  pageSize: { width: number; height: number } | null;
};

export type SheetViewportProps = {
  fileUrl: string;
  pageNumber?: number;
  overlayCanvasRef?: RefObject<HTMLCanvasElement>;
  overlaySvgRef?: RefObject<SVGSVGElement>;
  overlayContent?: ReactNode | ((transform: OverlayTransform) => ReactNode);
  onDocumentLoad?: (document: PDFDocumentProxy) => void;
  onPageLoad?: (page: PDFPageProxy) => void;
  initialZoom?: number;
  className?: string;
};

export function SheetViewport({
  fileUrl,
  pageNumber = 1,
  overlayCanvasRef,
  overlaySvgRef,
  overlayContent,
  onDocumentLoad,
  onPageLoad,
  initialZoom = 1,
  className
}: SheetViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [baseScale, setBaseScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const resizeTimeout = useRef<NodeJS.Timeout | null>(null);

  const renderScale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  const overlayTransform = useMemo<OverlayTransform>(
    () => ({ offset: pan, scale: renderScale, zoom, pageSize }),
    [pan, renderScale, zoom, pageSize]
  );

  const clampZoom = useCallback((value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)), []);

  const recomputeBaseScale = useCallback(() => {
    if (!pageSize || !containerRef.current) return;
    const { width: containerWidth, height: containerHeight } =
      containerRef.current.getBoundingClientRect();
    if (!containerWidth || !containerHeight) return;
    const widthScale = containerWidth / pageSize.width;
    const heightScale = containerHeight / pageSize.height;
    setBaseScale(Math.min(widthScale, heightScale));
  }, [pageSize]);

  useEffect(() => {
    recomputeBaseScale();
  }, [recomputeBaseScale, pageSize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
      resizeTimeout.current = setTimeout(() => recomputeBaseScale(), 150);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
    };
  }, [recomputeBaseScale]);

  const handlePageLoad = useCallback(
    (page: PDFPageProxy) => {
      const viewport = page.getViewport({ scale: 1 });
      setPageSize({ width: viewport.width, height: viewport.height });
      onPageLoad?.(page);
    },
    [onPageLoad]
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!containerRef.current || !pageSize) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = event.clientX - rect.left - pan.x;
      const pointerY = event.clientY - rect.top - pan.y;
      const zoomDirection = event.deltaY > 0 ? -0.1 : 0.1;
      const nextZoom = clampZoom(zoom + zoomDirection);
      const nextRenderScale = baseScale * nextZoom;
      const scaleRatio = nextRenderScale / renderScale;

      setPan((currentPan) => ({
        x: pointerX - (pointerX - currentPan.x) * scaleRatio,
        y: pointerY - (pointerY - currentPan.y) * scaleRatio
      }));
      setZoom(nextZoom);
    },
    [baseScale, clampZoom, pan.x, pan.y, pageSize, renderScale, zoom]
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isPanning.current = true;
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isPanning.current) return;
      const deltaX = event.clientX - pointerOrigin.current.x;
      const deltaY = event.clientY - pointerOrigin.current.y;
      setPan({ x: panStart.current.x + deltaX, y: panStart.current.y + deltaY });
    };

    const stopPanning = () => {
      isPanning.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopPanning);
    window.addEventListener('pointerleave', stopPanning);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopPanning);
      window.removeEventListener('pointerleave', stopPanning);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      className={className ?? 'relative h-full w-full overflow-hidden bg-muted'}
    >
      <Document file={fileUrl} onLoadSuccess={onDocumentLoad}>
        <div
          className="absolute top-0 left-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <Page pageNumber={pageNumber} scale={renderScale} onLoadSuccess={handlePageLoad} className="block" />

          {pageSize && (
            <div
              className="absolute top-0 left-0"
              style={{ width: pageSize.width * renderScale, height: pageSize.height * renderScale }}
            >
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{
                  width: pageSize.width,
                  height: pageSize.height,
                  transform: `scale(${renderScale})`,
                  transformOrigin: 'top left'
                }}
              >
                {overlayCanvasRef && (
                  <canvas
                    ref={overlayCanvasRef}
                    width={pageSize.width}
                    height={pageSize.height}
                    className="absolute inset-0"
                  />
                )}
                {overlaySvgRef && (
                  <svg
                    ref={overlaySvgRef}
                    width={pageSize.width}
                    height={pageSize.height}
                    className="absolute inset-0"
                  />
                )}
                {typeof overlayContent === 'function' ? overlayContent(overlayTransform) : overlayContent}
              </div>
            </div>
          )}
        </div>
      </Document>
    </div>
  );
}
