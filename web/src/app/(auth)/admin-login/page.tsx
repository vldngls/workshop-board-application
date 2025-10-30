"use client"

import { useEffect, useState } from "react"
import { useLogin, useLogout, useMe } from "@/hooks/useAuth"

export default function AdminLoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { refetch: refetchMe } = useMe()
  const login = useLogin()
  const logout = useLogout()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const isEmail = emailOrUsername.includes('@')
      const loginData = isEmail
        ? { email: emailOrUsername, password }
        : { username: emailOrUsername, password }

      await login.mutateAsync(loginData)
      const refreshed = await refetchMe()
      const role = refreshed.data?.user?.role
      if (role === 'superadmin') {
          window.location.href = "/dashboard/maintenance"
        } else {
          setError('Only superadmin is allowed during maintenance')
        await logout.mutateAsync()
      }
    } catch {
      setError("Network error - please try again")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-500 mt-1">Superadmin login during maintenance</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ford-blue focus:border-transparent"
                placeholder="you@example.com or admin"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ford-blue focus:border-transparent"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={!mounted || isLoading}
              className="w-full ford-gradient text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}


