
import prisma from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Calculate project progress based on approved/invoiced progress claims
 * and automatically update project status
 */
export async function calculateAndUpdateProjectProgress(projectId: string): Promise<{
  progress: number;
  status: string;
}> {
  try {
    // Get all approved/invoiced progress claims for this project
    const claims = await prisma.progressClaim.findMany({
      where: {
        projectId,
        status: {
          in: ['APPROVED', 'INVOICED'],
        },
      },
      include: {
        items: true,
      },
    });

    // Get project details including contract value
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        contractValue: true,
        estimatedBudget: true,
        status: true,
        progress: true,
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Calculate total approved amount from all claims
    const totalApprovedAmount = claims.reduce((sum, claim) => {
      const approvedAmount = claim.customerApprovedAmount || claim.currentClaimAmount;
      return sum + parseFloat(approvedAmount.toString());
    }, 0);

    // Calculate progress percentage based on contract value or estimated budget
    const baseValue = project.contractValue || project.estimatedBudget;
    let progressPercentage = 0;

    if (baseValue && parseFloat(baseValue.toString()) > 0) {
      progressPercentage = Math.round((totalApprovedAmount / parseFloat(baseValue.toString())) * 100);
      // Cap at 100%
      progressPercentage = Math.min(progressPercentage, 100);
    }

    // Determine new status based on progress
    let newStatus = project.status;
    
    // Auto-change to IN_PROGRESS if there's any progress and current status is PLANNING
    if (progressPercentage > 0 && project.status === 'PLANNING') {
      newStatus = 'IN_PROGRESS';
    }
    
    // Auto-change to COMPLETED if progress reaches 100%
    if (progressPercentage >= 100 && project.status !== 'COMPLETED') {
      newStatus = 'COMPLETED';
    }

    // Update project with new progress and status
    await prisma.project.update({
      where: { id: projectId },
      data: {
        progress: progressPercentage,
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Project ${projectId} progress updated: ${progressPercentage}% (Status: ${newStatus})`);

    return {
      progress: progressPercentage,
      status: newStatus,
    };
  } catch (error) {
    console.error('Error calculating project progress:', error);
    throw error;
  }
}

/**
 * Calculate progress for a specific project based on cumulative percentage from claims
 * This is an alternative method that uses the cumulative percentage from individual claim items
 */
export async function calculateProjectProgressFromItems(projectId: string): Promise<{
  progress: number;
  status: string;
}> {
  try {
    // Get all approved/invoiced progress claims for this project
    const claims = await prisma.progressClaim.findMany({
      where: {
        projectId,
        status: {
          in: ['APPROVED', 'INVOICED'],
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (claims.length === 0) {
      // No approved claims yet, return 0 progress
      return {
        progress: 0,
        status: 'PLANNING',
      };
    }

    // Get the latest claim's cumulative percentage
    // The cumulative percentage represents the total progress up to this claim
    const latestClaim = claims[0];
    const items = latestClaim.items;

    let totalProgress = 0;
    if (items.length > 0) {
      // Calculate average cumulative percentage across all items
      const sumCumulativePct = items.reduce((sum, item) => {
        return sum + parseFloat(item.cumulativePct.toString());
      }, 0);
      totalProgress = Math.round(sumCumulativePct / items.length);
    }

    // Cap at 100%
    totalProgress = Math.min(totalProgress, 100);

    // Get current project status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Determine new status based on progress
    let newStatus = project.status;
    
    // Auto-change to IN_PROGRESS if there's any progress and current status is PLANNING
    if (totalProgress > 0 && project.status === 'PLANNING') {
      newStatus = 'IN_PROGRESS';
    }
    
    // Auto-change to COMPLETED if progress reaches 100%
    if (totalProgress >= 100 && project.status !== 'COMPLETED') {
      newStatus = 'COMPLETED';
    }

    // Update project with new progress and status
    await prisma.project.update({
      where: { id: projectId },
      data: {
        progress: totalProgress,
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Project ${projectId} progress updated from items: ${totalProgress}% (Status: ${newStatus})`);

    return {
      progress: totalProgress,
      status: newStatus,
    };
  } catch (error) {
    console.error('Error calculating project progress from items:', error);
    throw error;
  }
}
