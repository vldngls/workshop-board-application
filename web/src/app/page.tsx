"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface MaintenanceStatus {
  isUnderMaintenance: boolean
  maintenanceMessage: string
}

export default function Home() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [progress, setProgress] = useState(0)
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null)
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true)

  useEffect(() => {
    const checkMaintenanceAndAuth = async () => {
      try {
        // Maintenance status is already checked by middleware, but we need it for UI
        // Use the status endpoint which has better caching
        const maintenanceResponse = await fetch('/api/maintenance/status', {
          method: 'GET',
          cache: 'no-store' // Always get fresh data for maintenance status
        })

        if (maintenanceResponse.ok) {
          const maintenanceData = await maintenanceResponse.json()
          setMaintenanceStatus({
            isUnderMaintenance: maintenanceData.isUnderMaintenance || false,
            maintenanceMessage: maintenanceData.maintenanceMessage || ''
          })
          
          // If under maintenance, don't proceed with auth check
          if (maintenanceData.isUnderMaintenance) {
            setIsCheckingMaintenance(false)
            setIsCheckingAuth(false)
            return
          }
        }

        // If not under maintenance, proceed with normal auth check
        const response = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          // User is authenticated, redirect to workshop dashboard
          router.prefetch("/dashboard/workshop")
          const t1 = setTimeout(() => setFadeOut(true), 1600)
          const t2 = setTimeout(() => router.push("/dashboard/workshop"), 2000)
          return () => { clearTimeout(t1); clearTimeout(t2) }
        } else {
          // User is not authenticated, redirect to login
          router.prefetch("/login")
          const t1 = setTimeout(() => setFadeOut(true), 1600)
          const t2 = setTimeout(() => router.push("/login"), 2000)
          return () => { clearTimeout(t1); clearTimeout(t2) }
        }
      } catch (error) {
        // Error occurred, redirect to login as fallback
        console.error('Auth check failed:', error)
        router.prefetch("/login")
        const t1 = setTimeout(() => setFadeOut(true), 1600)
        const t2 = setTimeout(() => router.push("/login"), 2000)
        return () => { clearTimeout(t1); clearTimeout(t2) }
      } finally {
        setIsCheckingAuth(false)
        setIsCheckingMaintenance(false)
      }
    }

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 200)

    checkMaintenanceAndAuth()

    return () => clearInterval(progressInterval)
  }, [router])

  // Show maintenance mode if enabled
  if (maintenanceStatus?.isUnderMaintenance) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6" style={{background: 'var(--ios-bg-secondary)'}}>
        <div className="flex flex-col items-center max-w-md mx-auto">
          {/* iOS 26 inspired logo container */}
          <div className="relative mb-12">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center border border-gray-200">
              <svg 
                className="animate-float" 
                width="48" 
                height="48" 
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
          </div>

          {/* Maintenance message */}
          <div className="text-center space-y-8">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-black animate-fade-in" style={{fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'}}>
                Job Control Board
              </h1>
              <p className="text-lg font-medium animate-fade-in" style={{animationDelay: '0.2s', color: 'var(--ios-text-secondary)'}}>
                System Maintenance
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in" style={{animationDelay: '0.3s'}}>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Under Maintenance</h2>
              
              <p className="text-gray-600 mb-6">
                {maintenanceStatus.maintenanceMessage || 'We are currently performing scheduled maintenance. Please check back later.'}
              </p>
              
              <p className="text-sm text-gray-500">
                We apologize for any inconvenience. Thank you for your patience.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Show loading state while checking maintenance and auth
  if (isCheckingMaintenance || isCheckingAuth) {
    return (
      <main className={`min-h-dvh flex items-center justify-center p-6 transition-all duration-700 ${fadeOut ? "opacity-0 scale-95" : "opacity-100 scale-100"}`} style={{background: 'var(--ios-bg-secondary)'}}>
        <div className="flex flex-col items-center max-w-md mx-auto">
          {/* iOS 26 inspired logo container */}
          <div className="relative mb-12">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center border border-gray-200">
              <svg 
                className="animate-float" 
                width="48" 
                height="48" 
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
          </div>

          {/* Main content with iOS 26 typography */}
          <div className="text-center space-y-8">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-black animate-fade-in" style={{fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'}}>
                Job Control Board
              </h1>
              <p className="text-lg font-medium animate-fade-in" style={{animationDelay: '0.2s', color: 'var(--ios-text-secondary)'}}>
                {isCheckingAuth ? "Verifying your access..." : "Welcome back!"}
              </p>
            </div>
            
            {isCheckingAuth && (
              <div className="w-full max-w-xs mx-auto animate-fade-in" style={{animationDelay: '0.3s'}}>
                <div className="flex items-center justify-between text-sm mb-3" style={{color: 'var(--ios-text-tertiary)'}}>
                  <span>Loading</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${progress}%`,
                      background: 'var(--ios-primary)'
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* iOS 26 inspired feature cards */}
            <div className="grid grid-cols-2 gap-4 mt-12 animate-fade-in" style={{animationDelay: '0.4s'}}>
              <div className="ios-card p-6 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{background: 'var(--ios-success)'}}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{color: 'var(--ios-text-primary)'}}>Job Management</p>
              </div>
              <div className="ios-card p-6 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{background: 'var(--ios-primary)'}}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{color: 'var(--ios-text-primary)'}}>Scheduling</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // This should not be reached, but just in case
  return null
}
