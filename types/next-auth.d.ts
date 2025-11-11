
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      firstName?: string | null
      lastName?: string | null
      companyName?: string | null
    }
  }

  interface User {
    role: string
    firstName?: string | null
    lastName?: string | null
    companyName?: string | null
  }
}
