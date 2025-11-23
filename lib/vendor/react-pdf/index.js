import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

export const pdfjs = { getDocument, GlobalWorkerOptions };

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
}

const DocumentContext = createContext(null);

export function Document({ file, children, onLoadSuccess, onLoadError }) {
  const [documentProxy, setDocumentProxy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let resolvedDocument = null;
    const loadingTask = getDocument(file);

    loadingTask.promise
      .then((loaded) => {
        if (cancelled) return;
        resolvedDocument = loaded;
        setDocumentProxy(loaded);
        onLoadSuccess?.(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        onLoadError?.(error);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy?.();
      resolvedDocument?.destroy?.();
    };
  }, [file, onLoadError, onLoadSuccess]);

  const value = useMemo(() => documentProxy, [documentProxy]);

  if (!documentProxy) {
    return null;
  }

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function Page({
  pageNumber,
  scale = 1,
  width,
  height,
  className,
  canvasRef,
  onLoadSuccess,
  onLoadError
}) {
  const documentProxy = useContext(DocumentContext);
  const internalCanvasRef = useRef(null);
  const resolvedCanvasRef = canvasRef ?? internalCanvasRef;
  const [renderedSize, setRenderedSize] = useState(null);

  useEffect(() => {
    if (!documentProxy || !pageNumber) return undefined;

    let cancelled = false;
    let renderTask = null;

    documentProxy
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const calculatedScale = width
          ? width / baseViewport.width
          : height
            ? height / baseViewport.height
            : scale;
        const viewport = page.getViewport({ scale: calculatedScale });
        const canvas = resolvedCanvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({ canvasContext: context, viewport });

        renderTask.promise
          .then(() => {
            if (cancelled) return;
            setRenderedSize({ width: viewport.width, height: viewport.height });
            onLoadSuccess?.(page);
          })
          .catch((error) => {
            if (cancelled) return;
            onLoadError?.(error);
          });
      })
      .catch((error) => {
        if (cancelled) return;
        onLoadError?.(error);
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [documentProxy, height, onLoadError, onLoadSuccess, pageNumber, resolvedCanvasRef, scale, width]);

  return (
    <canvas
      ref={resolvedCanvasRef}
      className={className}
      aria-label="PDF page canvas"
      style={
        renderedSize
          ? { width: `${renderedSize.width}px`, height: `${renderedSize.height}px` }
          : undefined
      }
    />
  );
}
