// src/app/dashboard/layout.tsx
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { redirect } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import type { ReactNode } from "react"
import type { Role } from "@/types/auth"

interface JWTPayload {
  userId: string
  email: string
  role: Role
  name?: string
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    redirect("/login")
  }

  let payload: JWTPayload
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured in dashboard layout')
      redirect("/login")
    }
    
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload: jwtPayload } = await jwtVerify(token, secret)
    payload = jwtPayload as unknown as JWTPayload
  } catch (err) {
    redirect("/login") // Invalid or expired token
  }

  const { role, name } = payload

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={role} name={name ?? null} />
      <main className="flex-1 bg-neutral-50 p-6 min-w-0">{children}</main>
    </div>
  )
}
