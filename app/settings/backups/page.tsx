
/**
 * Document Backups & Recovery Page
 * 
 * Allows admins to manage document backups and recovery
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DocumentBackupManager } from '@/components/documents/document-backup-manager'

export default async function BackupsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Only admins and superadmins can access
  const userRole = (session.user as any)?.role
  if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto p-6">
      <DocumentBackupManager />
    </div>
  )
}
