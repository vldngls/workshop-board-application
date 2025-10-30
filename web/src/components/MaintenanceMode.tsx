"use client"

import type { Role } from '@/types/auth'
import { useMe } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'

interface MaintenanceModeProps {
  children: React.ReactNode
}

export default function MaintenanceMode({ children }: MaintenanceModeProps) {
  const { data: meData, status: meStatus } = useMe()
  // dedicated admin login route handles auth during maintenance

  const maintenanceQuery = useQuery<{ isUnderMaintenance: boolean; maintenanceMessage?: string }>({
    queryKey: ['maintenance-status'],
    queryFn: async () => {
    try {
      const response = await fetch('/api/maintenance/status', { cache: 'no-store' })
        if (!response.ok) {
          // Treat 404 as "not under maintenance" for robustness in dev/local
          if (response.status === 404) {
            return { isUnderMaintenance: false, maintenanceMessage: '' }
          }
          throw new Error('Failed to fetch maintenance status')
        }
        return response.json()
      } catch {
        // Network or other errors: assume not under maintenance
        return { isUnderMaintenance: false, maintenanceMessage: '' }
      }
    },
    refetchOnWindowFocus: true,
    // Poll only when maintenance is ON; otherwise rely on focus/refetches
    refetchInterval: (data) => (data?.isUnderMaintenance ? 30000 : false),
    refetchIntervalInBackground: true,
    retry: false,
  })

  const isUnderMaintenance = !!maintenanceQuery.data?.isUnderMaintenance
  const maintenanceMessage = maintenanceQuery.data?.maintenanceMessage || ''

  // admin login handled at /admin-login

  if (maintenanceQuery.isLoading || meStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path === '/admin-login') {
      return <>{children}</>
    }
  }

  const userRole: Role | null = (meData?.user?.role as Role) ?? null
  if (isUnderMaintenance && userRole !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Site Under Maintenance</h1>
          
          <p className="text-gray-600 mb-6">
            {maintenanceMessage || 'We are currently performing scheduled maintenance. Please check back later.'}
          </p>
          
          <div className="text-sm text-gray-500 mb-4">
            We apologize for any inconvenience. Thank you for your patience.
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
