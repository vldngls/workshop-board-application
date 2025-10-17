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
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/auth/me', { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.user.role as Role)
        } else {
          setUserRole(null)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        setUserRole(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
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
