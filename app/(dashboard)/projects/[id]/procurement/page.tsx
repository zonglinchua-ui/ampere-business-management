import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import ProcurementManagement from '@/components/projects/procurement/procurement-management';

export const metadata: Metadata = {
  title: 'Procurement Documents | Ampere',
  description: 'Manage procurement documents with AI-powered extraction',
};

export default async function ProcurementPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      projectNumber: true,
    },
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <a href="/projects" className="hover:text-blue-600">
            Projects
          </a>
          <span className="mx-2">/</span>
          <a href={`/projects/${project.id}`} className="hover:text-blue-600">
            {project.projectNumber} - {project.name}
          </a>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Procurement</span>
        </div>
      </div>

      <ProcurementManagement projectId={params.id} />
    </div>
  );
}
