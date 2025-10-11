"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import type { Role } from "@/types/auth"

type NavItem = { href: string; label: string }

function getNavForRole(role: Role | null): { title: string; items: NavItem[] } {
  switch (role) {
    case "administrator":
      return {
        title: "Admin",
        items: [
          { href: "/dashboard/workshop", label: "Workshop" },
          { href: "/dashboard/job-orders", label: "Job Orders" },
          { href: "/dashboard/account-management", label: "Account Management" },
        ],
      }
    case "job-controller":
      return {
        title: "Job Controller",
        items: [
          { href: "/dashboard/workshop", label: "Workshop" },
          { href: "/dashboard/job-orders", label: "Job Orders" },
        ],
      }
    case "technician":
      return {
        title: "Technician",
        items: [{ href: "/dashboard/workshop", label: "Workshop" }],
      }
    default:
      return { title: "", items: [] }
  }
}

export default function Sidebar({ role, name }: { role: Role | null; name?: string | null }) {
  const { title, items } = getNavForRole(role)
  const pathname = usePathname()
  const router = useRouter()
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
    <aside className="w-64 min-w-64 max-w-64 border-r border-neutral-200 bg-white p-4 flex-shrink-0">
      <div className="mb-6">
        <div className="text-xl font-semibold text-[color:var(--color-ford-blue)]">{title}</div>
        <div className="text-sm text-neutral-500">Workshop Board</div>
        {name ? <div className="mt-2 text-sm text-neutral-700">Hi, {name}</div> : null}
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`sidebar-link ${pathname?.startsWith(item.href) ? "active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      <form onSubmit={handleLogout} className="mt-6">
        <button 
          type="submit"
          disabled={isLoggingOut}
          className="sidebar-link w-full justify-start text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </form>
    </aside>
  )
}


