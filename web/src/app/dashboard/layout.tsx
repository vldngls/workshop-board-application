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
    <div className="h-screen overflow-hidden" style={{background: 'var(--ios-bg-secondary)'}}>
      <Sidebar role={role} name={name ?? null} />
      <main className="ml-64 h-full overflow-auto p-6 min-w-0 transition-all duration-300 ease-in-out">{children}</main>
    </div>
  )
}
