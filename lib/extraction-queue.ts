// Simple in-memory queue for AI extraction jobs
// In production, this should be replaced with Redis, BullMQ, or similar

interface ExtractionJob {
  id: string;
  documentId: string;
  projectId: string;
  filePath: string;
  mimeType: string;
  documentType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class ExtractionQueue {
  private queue: ExtractionJob[] = [];
  private processing = false;

  addJob(job: Omit<ExtractionJob, 'status' | 'createdAt'>): ExtractionJob {
    const newJob: ExtractionJob = {
      ...job,
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.queue.push(newJob);
    console.log(`[Queue] Added job ${job.id} for document ${job.documentId}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
    
    return newJob;
  }

  getJob(id: string): ExtractionJob | undefined {
    return this.queue.find(job => job.id === id);
  }

  getJobByDocumentId(documentId: string): ExtractionJob | undefined {
    return this.queue.find(job => job.documentId === documentId);
  }

  private async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    console.log('[Queue] Started processing queue');

    while (this.queue.length > 0) {
      const job = this.queue.find(j => j.status === 'PENDING');
      if (!job) break;

      job.status = 'PROCESSING';
      job.startedAt = new Date();
      console.log(`[Queue] Processing job ${job.id} for document ${job.documentId}`);

      try {
        // Import the extraction function dynamically to avoid circular dependencies
        const { processExtraction } = await import('./extraction-processor');
        await processExtraction(job);
        
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        console.log(`[Queue] Completed job ${job.id} in ${Date.now() - job.startedAt.getTime()}ms`);
      } catch (error) {
        job.status = 'FAILED';
        job.error = (error as Error).message;
        job.completedAt = new Date();
        console.error(`[Queue] Failed job ${job.id}:`, error);
      }

      // Remove completed/failed jobs after 5 minutes to prevent memory leak
      setTimeout(() => {
        const index = this.queue.findIndex(j => j.id === job.id);
        if (index !== -1) {
          this.queue.splice(index, 1);
          console.log(`[Queue] Removed job ${job.id} from queue`);
        }
      }, 5 * 60 * 1000);
    }

    this.processing = false;
    console.log('[Queue] Finished processing queue');
  }

  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(j => j.status === 'PENDING').length,
      processing: this.queue.filter(j => j.status === 'PROCESSING').length,
      completed: this.queue.filter(j => j.status === 'COMPLETED').length,
      failed: this.queue.filter(j => j.status === 'FAILED').length,
    };
  }
}

// Singleton instance
export const extractionQueue = new ExtractionQueue();
