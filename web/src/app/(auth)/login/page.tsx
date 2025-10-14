"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      // Determine if input is email or username
      const isEmail = emailOrUsername.includes('@')
      const loginData = isEmail 
        ? { email: emailOrUsername, password }
        : { username: emailOrUsername, password }
      
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || "Invalid credentials")
        return
      }
      
      const data = await res.json()
      
      if (data.ok && data.role) {
        // Force a page refresh to ensure cookies are set
        window.location.href = "/dashboard/workshop"
      } else {
        setError("Login failed - no role received")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Network error - please try again")
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Workshop Board</h1>
        <p className="mb-6 text-sm text-neutral-600">Sign in to continue</p>
        {mounted ? (
          <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label className="mb-1 block text-sm font-medium">Email or Username</label>
              <input value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} type="text" required className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-ford-blue)]" autoComplete="username email" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-ford-blue)]" autoComplete="current-password" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="btn btn-primary w-full">Sign In</button>
          </form>
        ) : null}
      </div>
    </main>
  )
}


