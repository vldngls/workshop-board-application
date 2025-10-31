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
    // Only redirect if we have a definitive answer (status is success)
    // and the user doesn't have permission
    if (status === 'success' && userRole && !allowedRoles.includes(userRole)) {
      // Prevent redirect loops by checking current path
      const currentPath = window.location.pathname
      if (currentPath !== fallbackPath) {
        router.push(fallbackPath)
      }
    }
  }, [userRole, status, allowedRoles, router, fallbackPath])

  // Show loading while checking auth status
  if (status === 'pending' || status === 'loading') {
    return <div>Loading...</div>
  }

  // If not authenticated or role not allowed, don't render
  if (!userRole || !allowedRoles.includes(userRole)) {
    return null
  }

  return <>{children}</>
}
