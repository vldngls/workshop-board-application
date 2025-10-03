"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null
    if (role !== "administrator") {
      router.replace("/login")
    }
  }, [router])

  const nav = [
    { href: "/admin/workshop", label: "Workshop" },
    { href: "/admin/job-orders", label: "Job Orders" },
    { href: "/admin/account-management", label: "Account Management" },
  ]

  return (
    <div className="flex min-h-dvh">
      <aside className="w-64 border-r border-neutral-200 bg-white p-4">
        <div className="mb-6">
          <div className="text-xl font-semibold text-[color:var(--color-ford-blue)]">Admin</div>
          <div className="text-sm text-neutral-500">Workshop Board</div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={`sidebar-link ${pathname?.startsWith(item.href) ? "active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-neutral-50 p-6">{children}</main>
    </div>
  )
}


