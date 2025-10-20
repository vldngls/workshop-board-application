"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
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
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6" style={{background: 'var(--ios-bg-secondary)'}}>
      <div className="w-full max-w-md">
        {/* iOS 26 inspired header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6 border border-gray-200">
            <svg 
              className="animate-float" 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" 
                fill="#003478"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', color: 'var(--ios-text-primary)'}}>
            Job Control Board
          </h1>
          <p className="text-base font-medium" style={{color: 'var(--ios-text-secondary)'}}>
            Sign in to your account
          </p>
        </div>

        {/* iOS 26 inspired login form */}
        <div className="ios-card-elevated p-8 animate-fade-in" style={{animationDelay: '0.2s'}}>
          {mounted ? (
            <form onSubmit={onSubmit} className="space-y-6" autoComplete="on">
              <div className="space-y-5">
                <div className="form-field">
                  <label className="ios-label">
                    Email or Username
                  </label>
                  <div className="relative">
                    <input 
                      value={emailOrUsername} 
                      onChange={(e) => setEmailOrUsername(e.target.value)} 
                      type="text" 
                      required 
                      className="ios-input pl-4 pr-12" 
                      placeholder="Email or username"
                      autoComplete="username email" 
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5" style={{color: 'var(--ios-text-tertiary)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="form-field">
                  <label className="ios-label">
                    Password
                  </label>
                  <div className="relative">
                    <input 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      type={showPassword ? "text" : "password"}
                      required 
                      className="ios-input pl-4 pr-12" 
                      placeholder="Password"
                      autoComplete="current-password" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-auto hover:opacity-70 transition-opacity duration-200 z-10 bg-transparent border-none"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" style={{color: 'var(--ios-text-tertiary)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" style={{color: 'var(--ios-text-tertiary)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="form-error bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn w-full"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{borderColor: 'var(--ios-primary)'}}></div>
            </div>
          )}
        </div>

        {/* iOS 26 inspired footer */}
        <div className="text-center mt-8 animate-fade-in" style={{animationDelay: '0.4s'}}>
          <p className="text-sm" style={{color: 'var(--ios-text-tertiary)'}}>
            Secure access to your workshop management system
          </p>
        </div>
      </div>
    </main>
  )
}


