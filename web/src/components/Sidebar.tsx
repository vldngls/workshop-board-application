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
    <aside className="fixed top-0 left-0 w-64 min-w-64 max-w-64 flex-shrink-0 p-4 flex flex-col h-screen overflow-hidden ios-card border-r border-gray-200 z-10">
      <div>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 ford-gradient rounded-2xl shadow-lg flex items-center justify-center">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" 
                  fill="white"
                />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold" style={{color: 'var(--ios-text-primary)'}}>{title}</div>
              <div className="text-xs font-medium" style={{color: 'var(--ios-text-tertiary)'}}>Workshop Board</div>
            </div>
          </div>
          {userInfo.name ? (
            <div className="px-4 py-3 bg-white rounded-xl text-sm font-medium shadow-sm border border-gray-100" style={{color: 'var(--ios-text-secondary)'}}>
              Hi, {userInfo.name}
            </div>
          ) : null}
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                item.href === "/dashboard" 
                  ? (pathname === "/dashboard" ? "ford-gradient text-white shadow-lg" : "text-gray-700 hover:bg-gray-100")
                  : (pathname?.startsWith(item.href) ? "ford-gradient text-white shadow-lg" : "text-gray-700 hover:bg-gray-100")
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
          className="w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{color: 'var(--ios-text-secondary)'}}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </form>
    </aside>
  )
}


