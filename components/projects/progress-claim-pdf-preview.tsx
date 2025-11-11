
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProgressClaimPDFPreviewProps {
  claimId: string;
  claimNumber: string;
}

export function ProgressClaimPDFPreview({
  claimId,
  claimNumber,
}: ProgressClaimPDFPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set the PDF URL
    const url = `/api/progress-claims/${claimId}/preview-pdf?t=${Date.now()}`;
    setPdfUrl(url);
    setIsLoading(false);
  }, [claimId, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    setIsLoading(true);
    toast.success('PDF refreshed');
  };

  const handleDownloadPDF = async () => {
    if (!pdfUrl) return;

    setIsDownloadingPDF(true);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${claimNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF download started');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    try {
      const response = await fetch(`/api/progress-claims/${claimId}/excel`);
      if (!response.ok) throw new Error('Failed to generate Excel');

      const data = await response.json();

      // Download the file from the signed URL
      const fileResponse = await fetch(data.downloadUrl);
      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${claimNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Excel download started');
    } catch (err) {
      console.error('Error downloading Excel:', err);
      toast.error('Failed to download Excel');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Document Preview</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
            >
              {isDownloadingPDF ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={isDownloadingExcel}
            >
              {isDownloadingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}>
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-muted">
            <iframe
              src={pdfUrl}
              className="w-full"
              style={{ height: 'calc(100vh - 300px)', minHeight: '1000px' }}
              title="Progress Claim Preview"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
