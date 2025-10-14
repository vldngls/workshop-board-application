"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/workshop", label: "Workshop" }
        ],
      }
    default:
      return { title: "", items: [] }
  }
}

export default function Sidebar({ role, name }: { role: Role | null; name?: string | null }) {
  const { title, items } = getNavForRole(role)
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    <aside className="sticky top-0 w-64 min-w-64 max-w-64 border-r border-neutral-200 bg-white flex-shrink-0 p-4 flex flex-col h-screen overflow-hidden">
      <div>
        <div className="mb-6">
          <div className="text-xl font-semibold text-[color:var(--color-ford-blue)]">{title}</div>
          <div className="text-sm text-neutral-500">Workshop Board</div>
          {name ? <div className="mt-2 text-sm text-neutral-700">Hi, {name}</div> : null}
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`block px-3 py-2 rounded-lg transition-colors ${
                item.href === "/dashboard" 
                  ? (pathname === "/dashboard" ? "bg-[color:var(--color-ford-blue)] text-white" : "text-neutral-700 hover:bg-neutral-100")
                  : (pathname?.startsWith(item.href) ? "bg-[color:var(--color-ford-blue)] text-white" : "text-neutral-700 hover:bg-neutral-100")
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
          className="px-3 py-2 rounded-lg w-full text-left text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </form>
    </aside>
  )
}


