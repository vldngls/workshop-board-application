import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type MeResponse = {
  user?: {
    _id: string
    name: string
    role: string
    email?: string
  }
}

type LoginRequest = {
  email?: string
  username?: string
  password: string
}

type LoginResponse = {
  ok: boolean
  role?: string
  error?: string
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.status === 401) {
        // Not authenticated; return empty result and avoid throwing
        return {} as MeResponse
      }
      if (!res.ok) throw new Error('Failed to load user')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: async (payload: LoginRequest) => {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: (data as any).error || 'Invalid credentials' }
      }
      return data as LoginResponse
    },
    onSuccess: (data) => {
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: ['me'] })
      }
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Logout failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.clear()
    },
  })
}


