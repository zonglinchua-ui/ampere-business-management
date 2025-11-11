

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { intelligentMatch } from '@/lib/fuzzy-match'

/**
 * POST /api/suppliers/match
 * Intelligently match a supplier name to existing suppliers using fuzzy matching
 * 
 * Request body: { supplierName: string }
 * Response: { 
 *   matched: boolean, 
 *   supplier: { id, name } | null, 
 *   confidence: 'exact' | 'high' | 'medium' | 'low' | 'none',
 *   score: number,
 *   reason: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { supplierName } = body

    if (!supplierName || typeof supplierName !== 'string') {
      return NextResponse.json({ 
        error: 'Supplier name is required' 
      }, { status: 400 })
    }

    // Get all active suppliers from the database
    const suppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        supplierNumber: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    if (suppliers.length === 0) {
      return NextResponse.json({
        matched: false,
        supplier: null,
        confidence: 'none',
        score: 0,
        reason: 'No suppliers in database'
      })
    }

    // Perform intelligent matching
    const matchResult = intelligentMatch(
      supplierName,
      suppliers,
      (supplier) => supplier.name
    )

    return NextResponse.json({
      matched: matchResult.match !== null,
      supplier: matchResult.match ? {
        id: matchResult.match.id,
        name: matchResult.match.name,
        supplierNumber: matchResult.match.supplierNumber
      } : null,
      confidence: matchResult.confidence,
      score: matchResult.score,
      reason: matchResult.reason
    })

  } catch (error) {
    console.error('Error matching supplier:', error)
    return NextResponse.json({ 
      error: 'Failed to match supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

