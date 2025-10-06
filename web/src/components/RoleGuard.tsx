"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { Role } from "@/types/auth"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: Role[]
  fallbackPath?: string
}

export default function RoleGuard({ children, allowedRoles, fallbackPath = "/login" }: RoleGuardProps) {
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Get role from cookies (client-side)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }

    const role = getCookie("role") as Role | null
    setUserRole(role)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!loading && (!userRole || !allowedRoles.includes(userRole))) {
      router.push(fallbackPath)
    }
  }, [userRole, loading, allowedRoles, router, fallbackPath])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return null
  }

  return <>{children}</>
}
