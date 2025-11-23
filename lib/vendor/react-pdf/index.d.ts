import type { ReactNode, RefObject } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export const pdfjs: typeof import('pdfjs-dist');

export interface DocumentProps {
  file: string | URL | ArrayBuffer;
  children?: ReactNode;
  onLoadSuccess?: (document: PDFDocumentProxy) => void;
  onLoadError?: (error: unknown) => void;
}

export function Document(props: DocumentProps): JSX.Element | null;

export interface PageProps {
  pageNumber: number;
  scale?: number;
  width?: number;
  height?: number;
  className?: string;
  canvasRef?: RefObject<HTMLCanvasElement>;
  onLoadSuccess?: (page: PDFPageProxy) => void;
  onLoadError?: (error: unknown) => void;
}

export function Page(props: PageProps): JSX.Element | null;
