import { cookies } from "next/headers"
import Sidebar from "@/components/Sidebar"
import type { Role } from "@/types/auth"

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const role = (cookieStore.get("role")?.value ?? null) as Role | null
  const name = cookieStore.get("name")?.value ?? null

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={role} name={name} />
      <main className="flex-1 bg-neutral-50 p-6">{children}</main>
    </div>
  )
}


