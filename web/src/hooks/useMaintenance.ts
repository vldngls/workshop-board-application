import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'

export function useBugReports(enabled: boolean = true) {
  return useQuery<{ bugReports: any[] }>({
    queryKey: ['bug-reports'],
    queryFn: async () => {
      const res = await fetch('/api/bug-reports', { credentials: 'include' })
      if (!res.ok) {
        // Don't throw for 401/403 - user might not have permission
        if (res.status === 401 || res.status === 403) {
          return { bugReports: [] }
        }
        throw new Error('Failed to fetch bug reports')
      }
      return res.json()
    },
    enabled, // Only run when explicitly enabled
    staleTime: 60_000,
    retry: false, // Don't retry on error to avoid spam
    refetchOnWindowFocus: false, // Prevent auto-refetch on focus to reduce errors
  })
}

export function useSystemStats() {
  return useQuery<any>({
    queryKey: ['maintenance-stats'],
    queryFn: async () => {
      const res = await fetch('/api/maintenance/stats', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useMaintenanceSettings() {
  const queryClient = useQueryClient()
  const query = useQuery<any>({
    queryKey: ['maintenance-settings'],
    queryFn: async () => {
      const res = await fetch('/api/maintenance/settings', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
  })
  const mutation = useMutation<any, Error, any>({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/maintenance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-settings'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-status'] })
    },
  })
  return { ...query, updateSettings: mutation }
}

export function useSystemLogs(limit = 100, enabled = false) {
  return useQuery<{ items: any[] }>({
    queryKey: ['system-logs', limit],
    queryFn: async () => {
      const res = await fetch(`/api/system-logs?limit=${limit}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch system logs')
      return res.json()
    },
    enabled,
  })
}

export function useInfiniteSystemLogs(params: { level?: string; userEmail?: string; path?: string; limit?: number; enabled?: boolean }) {
  const { level, userEmail, path, limit = 50, enabled = false } = params
  return useInfiniteQuery<{ items: any[]; page: number; total: number; limit: number }>(
    {
      queryKey: ['system-logs', 'infinite', { level, userEmail, path, limit }],
      queryFn: async ({ pageParam }) => {
        const url = new URL('/api/system-logs', window.location.origin)
        url.searchParams.set('page', String(pageParam))
        url.searchParams.set('limit', String(limit))
        if (level) url.searchParams.set('level', level)
        if (userEmail) url.searchParams.set('userEmail', userEmail)
        if (path) url.searchParams.set('path', path)
        const res = await fetch(url.toString().replace(window.location.origin, ''), { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to fetch system logs')
        return res.json()
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { page, total, limit: pageSize } = lastPage
        const totalPages = Math.ceil((total || 0) / (pageSize || 1))
        if (page < totalPages) return page + 1
        return undefined
      },
      enabled,
      staleTime: 10_000,
    }
  )
}

export function useUpdateBugReport() {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { id: string; updates: any }>({
    mutationFn: async ({ id, updates }) => {
      const res = await fetch(`/api/bug-reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update bug report')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] })
    },
  })
}


