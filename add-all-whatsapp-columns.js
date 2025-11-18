const { Client } = require('pg')

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'ampere_db',
  user: 'ampere_user',
  password: 'Ampere2024!',
})

async function addAllColumns() {
  try {
    await client.connect()
    console.log('Connected to database')

    // Create WhatsAppGlobalSettings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WhatsAppGlobalSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "quietHoursStart" TEXT,
        "quietHoursEnd" TEXT,
        "defaultCountryCode" TEXT NOT NULL DEFAULT '+65',
        "maxMessagesPerHour" INTEGER NOT NULL DEFAULT 100,
        "testMode" BOOLEAN NOT NULL DEFAULT false,
        "testPhoneNumber" TEXT,
        "wahaApiUrl" TEXT,
        "wahaApiKey" TEXT,
        "wahaSession" TEXT NOT NULL DEFAULT 'default',
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Created WhatsAppGlobalSettings table')

    // Create WhatsAppAlertSettings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WhatsAppAlertSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "alertType" TEXT NOT NULL UNIQUE,
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "daysBefore" TEXT,
        "daysAfter" TEXT,
        "sendToAssignedUser" BOOLEAN NOT NULL DEFAULT true,
        "sendToManager" BOOLEAN NOT NULL DEFAULT false,
        "sendToCustomer" BOOLEAN NOT NULL DEFAULT false,
        "sendToFinanceTeam" BOOLEAN NOT NULL DEFAULT false,
        "sendToSalesTeam" BOOLEAN NOT NULL DEFAULT false,
        "sendToSuperAdmins" BOOLEAN NOT NULL DEFAULT false,
        "minimumAmount" DECIMAL(65,30),
        "percentageThreshold" INTEGER,
        "messageTemplate" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Created WhatsAppAlertSettings table')

    // Create WhatsAppRoleRecipients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WhatsAppRoleRecipients" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "roleName" TEXT NOT NULL UNIQUE,
        "phoneNumbers" TEXT[] NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Created WhatsAppRoleRecipients table')

    // Create WhatsAppNotificationLog table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WhatsAppNotificationLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "alertType" TEXT NOT NULL,
        "recipientPhone" TEXT NOT NULL,
        "recipientName" TEXT,
        "recipientRole" TEXT,
        "message" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'QUEUED',
        "errorMessage" TEXT,
        "sentAt" TIMESTAMP(3),
        "retryCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Created WhatsAppNotificationLog table')

    console.log('All WhatsApp tables created successfully!')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

addAllColumns()
