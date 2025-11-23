

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage settings
    const userRole = session.user?.role
    if (!["SUPERADMIN"].includes(userRole || "")) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get settings from file or return defaults
    let savedSettings = {}
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8')
        savedSettings = JSON.parse(fileContent)
      }
    } catch (error) {
      console.error('Error reading settings file:', error)
    }

    // Return default settings with overrides from file
    const defaultSettings = {
      companyName: "Ampere Engineering Pte Ltd",
      companyEmail: "projects@ampere.com.sg",
      currency: "SGD",
      timezone: "Asia/Singapore",
      dateFormat: "DD/MM/YYYY",
      language: "English",
      theme: "system",
      notifications: {
        email: true,
        browser: true,
        mobile: false
      },
      security: {
        twoFactorAuth: false,
        sessionTimeout: 30,
        passwordPolicy: "medium"
      },
      storage: {
        nasEnabled: false,
        nasPath: "",
        nasUsername: "",
        nasPassword: "",
        autoDownload: true,
        organizeFolders: true,
        namingConvention: "{quotationNumber}.{clientName}.{projectName}.{title}"
      },
      ...savedSettings
    }

    return NextResponse.json(defaultSettings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage settings
    const userRole = session.user?.role
    if (!["SUPERADMIN"].includes(userRole || "")) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const settingsData = await request.json()

    // Ensure data directory exists
    const dataDir = path.dirname(SETTINGS_FILE)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Add metadata
    const settingsToSave = {
      ...settingsData,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: session.user?.id || '',
      lastUpdatedByEmail: session.user?.email || ''
    }

    // Save to file
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2))

    return NextResponse.json({ success: true, message: 'Settings saved successfully' })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

