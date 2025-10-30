"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import type { Role } from "@/types/auth"
import { useMe } from "@/hooks/useAuth"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: Role[]
  fallbackPath?: string
}

export default function RoleGuard({ children, allowedRoles, fallbackPath = "/login" }: RoleGuardProps) {
  const { data: meData, status } = useMe()
  const router = useRouter()

  const userRole: Role | null = (meData?.user?.role as Role) ?? null

  useEffect(() => {
    if (status === 'success') {
      if (!userRole || !allowedRoles.includes(userRole)) {
        router.push(fallbackPath)
      }
    }
  }, [userRole, status, allowedRoles, router, fallbackPath])

  if (status !== 'success') {
    return <div>Loading...</div>
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return null
  }

  return <>{children}</>
}
