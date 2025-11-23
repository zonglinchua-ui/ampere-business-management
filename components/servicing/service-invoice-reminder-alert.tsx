
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Clock, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface InvoiceReminder {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date | string;
  daysUntilDue: number;
  urgency: 'overdue' | 'urgent' | 'upcoming';
  jobId: string;
  jobNumber: string;
  customerName: string;
  status: string;
}

interface ServiceInvoiceReminderAlertProps {
  jobId?: string;
  contractId?: string;
  showJobLink?: boolean;
}

export function ServiceInvoiceReminderAlert({ 
  jobId,
  contractId, 
  showJobLink = false 
}: ServiceInvoiceReminderAlertProps) {
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchReminders();
  }, [jobId, contractId]);

  const fetchReminders = async () => {
    try {
      let url = '/api/servicing/invoice-reminders';
      if (jobId) {
        url += `?jobId=${jobId}`;
      } else if (contractId) {
        url += `?contractId=${contractId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReminders(data.reminders || []);
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || reminders.length === 0) {
    return null;
  }

  const overdueReminders = reminders.filter(r => r.urgency === 'overdue');
  const urgentReminders = reminders.filter(r => r.urgency === 'urgent');
  const upcomingReminders = reminders.filter(r => r.urgency === 'upcoming');

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'overdue':
        return {
          icon: XCircle,
          variant: 'destructive' as const,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-900'
        };
      case 'urgent':
        return {
          icon: AlertCircle,
          variant: 'default' as const,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-900'
        };
      default:
        return {
          icon: Clock,
          variant: 'default' as const,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-900'
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD'
    }).format(amount);
  };

  const handleViewInvoice = (reminderId: string, jobId: string) => {
    router.push(`/servicing/jobs/${jobId}?tab=invoices&highlight=${reminderId}`);
  };

  return (
    <div className="space-y-4">
      {overdueReminders.length > 0 && (
        <Alert className={`${getUrgencyConfig('overdue').bgColor} ${getUrgencyConfig('overdue').borderColor}`}>
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            Overdue Invoices ({overdueReminders.length})
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {overdueReminders.map(reminder => (
              <div 
                key={reminder.id} 
                className="flex items-center justify-between p-2 bg-white rounded border border-red-100"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {reminder.invoiceNumber}
                    </span>
                    {showJobLink && (
                      <Badge variant="outline" className="text-xs">
                        {reminder.jobNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {reminder.customerName} • {formatCurrency(reminder.amount)} • 
                    Overdue by {Math.abs(reminder.daysUntilDue)} day(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleViewInvoice(reminder.id, reminder.jobId)}
                >
                  View
                </Button>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {urgentReminders.length > 0 && (
        <Alert className={`${getUrgencyConfig('urgent').bgColor} ${getUrgencyConfig('urgent').borderColor}`}>
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900 font-semibold">
            Due Soon ({urgentReminders.length})
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {urgentReminders.map(reminder => (
              <div 
                key={reminder.id} 
                className="flex items-center justify-between p-2 bg-white rounded border border-orange-100"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {reminder.invoiceNumber}
                    </span>
                    {showJobLink && (
                      <Badge variant="outline" className="text-xs">
                        {reminder.jobNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {reminder.customerName} • {formatCurrency(reminder.amount)} • 
                    Due in {reminder.daysUntilDue} day(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleViewInvoice(reminder.id, reminder.jobId)}
                >
                  View
                </Button>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {upcomingReminders.length > 0 && !jobId && (
        <Alert className={`${getUrgencyConfig('upcoming').bgColor} ${getUrgencyConfig('upcoming').borderColor}`}>
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 font-semibold">
            Upcoming Due Dates ({upcomingReminders.length})
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {upcomingReminders.slice(0, 3).map(reminder => (
              <div 
                key={reminder.id} 
                className="flex items-center justify-between p-2 bg-white rounded border border-blue-100"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {reminder.invoiceNumber}
                    </span>
                    {showJobLink && (
                      <Badge variant="outline" className="text-xs">
                        {reminder.jobNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {reminder.customerName} • {formatCurrency(reminder.amount)} • 
                    Due in {reminder.daysUntilDue} day(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleViewInvoice(reminder.id, reminder.jobId)}
                >
                  View
                </Button>
              </div>
            ))}
            {upcomingReminders.length > 3 && (
              <p className="text-xs text-blue-700 mt-2">
                +{upcomingReminders.length - 3} more upcoming invoices
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
