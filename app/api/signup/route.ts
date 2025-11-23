
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().optional(),
  role: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // For internal testing: Disable public registration
    // Only SUPERADMIN can create new users
    if (process.env.DEPLOYMENT_MODE === 'internal_testing') {
      const session = await getServerSession(authOptions)
      
      if (!session || session.user.role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: "Public registration is disabled. Please contact your administrator." },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const { email, password, firstName, lastName, companyName, role } = signupSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Validate role
    const validRoles = ["SUPERADMIN", "PROJECT_MANAGER", "FINANCE", "SALES", "VENDOR"]
    const userRole = role && validRoles.includes(role) ? role : "PROJECT_MANAGER"

    // Create user
    const user = await prisma.user.create({
      data: {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        companyName: companyName || "Ampere Engineering",
        role: userRole as any,
        updatedAt: new Date(),
      },
    })

    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      { message: "User created successfully", user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
