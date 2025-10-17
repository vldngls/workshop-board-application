"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import type { Role } from "@/types/auth"

type NavItem = { href: string; label: string }

function getNavForRole(role: Role | null): { title: string; items: NavItem[] } {
  switch (role) {
    case "administrator":
      return {
        title: "Admin",
        items: [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/workshop", label: "Workshop" },
          { href: "/dashboard/job-orders", label: "Job Orders" },
          { href: "/dashboard/appointments", label: "Appointments" },
          { href: "/dashboard/account-management", label: "Account Management" },
        ],
      }
    case "job-controller":
      return {
        title: "Job Controller",
        items: [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/workshop", label: "Workshop" },
          { href: "/dashboard/job-orders", label: "Job Orders" },
          { href: "/dashboard/appointments", label: "Appointments" },
        ],
      }
    case "technician":
      return {
        title: "Technician",
        items: [
          { href: "/dashboard/technician", label: "My Dashboard" },
          { href: "/dashboard/workshop", label: "Workshop Board" }
        ],
      }
    default:
      return { title: "", items: [] }
  }
}

export default function Sidebar({ role, name }: { role: Role | null; name?: string | null }) {
  const [userInfo, setUserInfo] = useState<{ role: Role | null; name: string | null }>({ role, name })
  const { title, items } = getNavForRole(userInfo.role)
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Get user info from server
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUserInfo({ role: data.user.role as Role, name: data.user.name })
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingOut(true)
    
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
      })
      
      if (response.ok) {
        // Clear any client-side state if needed
        // Force a full page reload to ensure all state is cleared
        window.location.href = '/login'
      } else {
        console.error('Logout failed')
        // Still redirect to login even if logout API fails
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if logout API fails
      window.location.href = '/login'
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <aside className="fixed top-0 left-0 w-64 min-w-64 max-w-64 flex-shrink-0 p-4 flex flex-col h-screen overflow-hidden glass border-r border-white/30 z-10">
      <div>
        <div className="mb-8">
          <div className="text-xl font-bold text-ford-blue">{title}</div>
          <div className="text-sm text-neutral-600 font-medium">Workshop Board</div>
          {userInfo.name ? <div className="mt-3 px-3 py-2 bg-white/50 rounded-xl text-sm text-neutral-700 font-medium backdrop-blur-sm">Hi, {userInfo.name}</div> : null}
        </div>
        <nav className="space-y-2">
          {items.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`sidebar-link ${
                item.href === "/dashboard" 
                  ? (pathname === "/dashboard" ? "active" : "")
                  : (pathname?.startsWith(item.href) ? "active" : "")
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <form onSubmit={handleLogout} className="mt-auto">
        <button 
          type="submit"
          disabled={isLoggingOut}
          className="px-3 py-2.5 rounded-xl w-full text-left text-neutral-700 hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </form>
    </aside>
  )
}


