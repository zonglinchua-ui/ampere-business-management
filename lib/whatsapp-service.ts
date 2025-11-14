/**
 * WhatsApp Notification Service using WAHA API
 * 
 * This service integrates with WAHA (WhatsApp HTTP API) to send
 * notifications via WhatsApp for various business events.
 */

export interface WhatsAppMessage {
  chatId: string // Phone number in format: 6512345678@c.us
  text: string
  session?: string
}

export interface WhatsAppConfig {
  apiUrl: string
  apiKey: string
  session: string
  enabled: boolean
}

/**
 * Get WhatsApp configuration from environment
 */
function getWhatsAppConfig(): WhatsAppConfig {
  return {
    apiUrl: process.env.WAHA_API_URL || 'http://localhost:3000',
    apiKey: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || 'default',
    enabled: process.env.WAHA_ENABLED === 'true'
  }
}

/**
 * Format phone number to WhatsApp chat ID format
 * Input: +65 1234 5678 or 6512345678
 * Output: 6512345678@c.us
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Add @c.us suffix
  return `${cleaned}@c.us`
}

/**
 * Send a text message via WhatsApp
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getWhatsAppConfig()
    
    // Check if WhatsApp is enabled
    if (!config.enabled) {
      console.log('[WhatsApp] Service is disabled, skipping message')
      return { success: true } // Return success to not break the flow
    }
    
    // Check if API key is configured
    if (!config.apiKey) {
      console.warn('[WhatsApp] API key not configured, skipping message')
      return { success: false, error: 'WhatsApp API key not configured' }
    }
    
    const chatId = formatPhoneNumber(phoneNumber)
    
    console.log(`[WhatsApp] Sending message to ${chatId}`)
    
    const response = await fetch(`${config.apiUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey
      },
      body: JSON.stringify({
        session: config.session,
        chatId: chatId,
        text: message
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WhatsApp] Failed to send message: ${response.status} - ${errorText}`)
      return {
        success: false,
        error: `Failed to send WhatsApp message: ${response.status}`
      }
    }
    
    const result = await response.json()
    console.log(`[WhatsApp] Message sent successfully:`, result)
    
    return { success: true }
    
  } catch (error: any) {
    console.error('[WhatsApp] Error sending message:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Send WhatsApp notification for tender deadline
 */
export async function sendTenderDeadlineNotification(
  phoneNumber: string,
  tenderNumber: string,
  tenderName: string,
  deadline: Date,
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  const deadlineStr = deadline.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  
  const message = `🔔 *Tender Deadline Reminder*

Tender: ${tenderNumber}
Name: ${tenderName}
Deadline: ${deadlineStr}
⏰ ${daysRemaining} day(s) remaining

Please ensure your submission is completed on time.

_This is an automated message from Ampere Business Management System_`
  
  return await sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Send WhatsApp notification for task deadline
 */
export async function sendTaskDeadlineNotification(
  phoneNumber: string,
  taskTitle: string,
  taskDescription: string | null,
  dueDate: Date,
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  
  const message = `📋 *Task Reminder*

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}\n` : ''}Due Date: ${dueDateStr}
⏰ ${daysRemaining} day(s) remaining

Please complete this task before the deadline.

_This is an automated message from Ampere Business Management System_`
  
  return await sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Send WhatsApp notification for outstanding invoice
 */
export async function sendOutstandingInvoiceNotification(
  phoneNumber: string,
  invoiceNumber: string,
  customerName: string,
  amount: number,
  dueDate: Date,
  daysOverdue: number
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  
  const amountStr = new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD'
  }).format(amount)
  
  const urgency = daysOverdue > 0 ? '⚠️ OVERDUE' : '⏰ Due Soon'
  
  const message = `💰 *${urgency} Invoice Reminder*

Invoice: ${invoiceNumber}
Customer: ${customerName}
Amount: ${amountStr}
Due Date: ${dueDateStr}
${daysOverdue > 0 ? `Days Overdue: ${daysOverdue}` : `Days Remaining: ${Math.abs(daysOverdue)}`}

Please arrange for payment at your earliest convenience.

_This is an automated message from Ampere Business Management System_`
  
  return await sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Send WhatsApp notification for outstanding submission
 */
export async function sendOutstandingSubmissionNotification(
  phoneNumber: string,
  submissionType: string,
  projectNumber: string,
  projectName: string,
  dueDate: Date,
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  
  const message = `📄 *Outstanding Submission Reminder*

Type: ${submissionType}
Project: ${projectNumber} - ${projectName}
Due Date: ${dueDateStr}
⏰ ${daysRemaining} day(s) remaining

Please submit the required documents before the deadline.

_This is an automated message from Ampere Business Management System_`
  
  return await sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Send WhatsApp notification for project update
 */
export async function sendProjectUpdateNotification(
  phoneNumber: string,
  projectNumber: string,
  projectName: string,
  updateMessage: string
): Promise<{ success: boolean; error?: string }> {
  const message = `🏗️ *Project Update*

Project: ${projectNumber} - ${projectName}

${updateMessage}

_This is an automated message from Ampere Business Management System_`
  
  return await sendWhatsAppMessage(phoneNumber, message)
}

/**
 * Check if WhatsApp service is available
 */
export async function checkWhatsAppStatus(): Promise<{
  available: boolean
  error?: string
}> {
  try {
    const config = getWhatsAppConfig()
    
    if (!config.enabled) {
      return { available: false, error: 'WhatsApp service is disabled' }
    }
    
    if (!config.apiKey) {
      return { available: false, error: 'WhatsApp API key not configured' }
    }
    
    // Try to ping the API
    const response = await fetch(`${config.apiUrl}/api/sessions`, {
      method: 'GET',
      headers: {
        'X-Api-Key': config.apiKey
      }
    })
    
    if (!response.ok) {
      return {
        available: false,
        error: `WhatsApp API returned ${response.status}`
      }
    }
    
    return { available: true }
    
  } catch (error: any) {
    return {
      available: false,
      error: error.message || 'Unknown error'
    }
  }
}
