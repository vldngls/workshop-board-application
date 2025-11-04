import { useEffect, useRef } from 'react'

/**
 * Hook to automatically refresh tokens before expiration
 * Checks token expiration and refreshes it 1 hour before expiry
 */
export function useTokenRefresh() {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })

        if (response.ok) {
          console.log('[TOKEN] Token refreshed successfully')
        } else {
          console.warn('[TOKEN] Token refresh failed, user may need to login')
          // If refresh fails, the middleware will handle redirecting to login
        }
      } catch (error) {
        console.error('[TOKEN] Token refresh error:', error)
      }
    }

    // Refresh token every 7 hours (1 hour before 8-hour expiration)
    // This ensures users stay logged in during work hours
    const interval = setInterval(() => {
      refreshToken()
    }, 7 * 60 * 60 * 1000) // 7 hours

    refreshIntervalRef.current = interval

    // Also refresh on page focus (if user comes back after a while)
    const handleFocus = () => {
      refreshToken()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
}

