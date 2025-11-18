import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import POApprovalDashboard from '@/components/projects/procurement/po-approval-dashboard';

export const metadata: Metadata = {
  title: 'PO Approvals | Ampere',
  description: 'Review and approve purchase order generation requests',
};

export default async function POApprovalsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  // Only superadmins can access this page
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <POApprovalDashboard showAllProjects={true} />
    </div>
  );
}
