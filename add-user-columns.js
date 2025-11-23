const { Client } = require('pg')

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'ampere_db',
  user: 'ampere_user',
  password: 'Ampere2024!',
})

async function addColumns() {
  try {
    await client.connect()
    console.log('Connected to database')

    await client.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;')
    console.log('Added phone column')

    await client.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappNotifications" BOOLEAN NOT NULL DEFAULT true;')
    console.log('Added whatsappNotifications column')

    await client.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappAlertPreferences" JSONB;')
    console.log('Added whatsappAlertPreferences column')

    console.log('All columns added successfully!')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

addColumns()
