'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a client with optimized settings
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache for 5 minutes by default
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Retry failed requests
        retry: 1,
        // Only refetch on mount when stale to leverage cache effectively
        refetchOnMount: true,
        // Handle errors globally to prevent unhandled promise rejections
        onError: (error: Error) => {
          // Only log errors that aren't expected (401/403/404)
          if (error.message && !error.message.includes('401') && !error.message.includes('403') && !error.message.includes('404')) {
            console.error('Query error:', error)
          }
        },
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        // Handle mutation errors globally
        onError: (error: Error) => {
          console.error('Mutation error:', error)
        },
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== 'production' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}

