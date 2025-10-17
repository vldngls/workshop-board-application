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
        window.location.href = "/dashboard"
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
      <div className="w-full max-w-md floating-card p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-ford-blue to-ford-blue-light bg-clip-text text-transparent">Workshop Board</h1>
          <p className="text-sm text-neutral-600 font-medium">Sign in to continue</p>
        </div>
        {mounted ? (
          <form onSubmit={onSubmit} className="space-y-5" autoComplete="on">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Email or Username</label>
              <input value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} type="text" required className="w-full px-4 py-3" autoComplete="username email" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full px-4 py-3" autoComplete="current-password" />
            </div>
            {error ? <p className="text-sm text-red-600 font-medium bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3">{error}</p> : null}
            <button type="submit" className="btn btn-primary w-full py-3 text-base">Sign In</button>
          </form>
        ) : null}
      </div>
    </main>
  )
}


