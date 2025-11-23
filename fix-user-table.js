const { Client } = require('pg')

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'ampere_db',
  user: 'ampere_user',
  password: 'Ampere2024!',
})

async function fixUserTable() {
  try {
    await client.connect()
    console.log('Connected to database')

    // Check what columns exist in User table
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User'
      ORDER BY ordinal_position;
    `)
    
    console.log('Current User table columns:')
    result.rows.forEach(row => console.log('  -', row.column_name))

    // Remove incorrect columns if they exist
    const incorrectColumns = ['quietHoursStart', 'quietHoursEnd', 'defaultCountryCode', 'maxMessagesPerHour', 'testMode', 'testPhoneNumber', 'wahaApiUrl', 'wahaApiKey', 'wahaSession', 'enabled']
    
    for (const col of incorrectColumns) {
      try {
        await client.query(`ALTER TABLE "User" DROP COLUMN IF EXISTS "${col}";`)
        console.log(`Dropped column: ${col}`)
      } catch (err) {
        // Column doesn't exist, ignore
      }
    }

    console.log('User table fixed!')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

fixUserTable()
