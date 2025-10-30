import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useBugReports() {
  return useQuery<{ bugReports: any[] }>({
    queryKey: ['bug-reports'],
    queryFn: async () => {
      const res = await fetch('/api/bug-reports', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch bug reports')
      return res.json()
    },
    staleTime: 60_000,
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


