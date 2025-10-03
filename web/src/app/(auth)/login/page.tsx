"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Role = "administrator" | "job-controller" | "technician"

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>("administrator")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem("role", role)
    if (role === "administrator") router.push("/admin")
    else if (role === "job-controller") router.push("/job-controller")
    else router.push("/technician")
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Workshop Board</h1>
        <p className="mb-6 text-sm text-neutral-600">Sign in to continue</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-ford-blue)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-ford-blue)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-ford-blue)]">
              <option value="administrator">Administrator</option>
              <option value="job-controller">Job Controller</option>
              <option value="technician">Technician</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">Sign In</button>
        </form>
      </div>
    </main>
  )
}


