import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { JobOrder, CreateJobOrderRequest, JobStatus, JobItemStatus } from '@/types/jobOrder'
import toast from 'react-hot-toast'

// Query keys for consistent caching
export const jobOrderKeys = {
  all: ['jobOrders'] as const,
  lists: () => [...jobOrderKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...jobOrderKeys.lists(), filters] as const,
  details: () => [...jobOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobOrderKeys.details(), id] as const,
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...userKeys.lists(), filters] as const,
  technicians: () => [...userKeys.all, 'technicians'] as const,
  available: (date: string, startTime: string, endTime: string) => 
    [...userKeys.technicians(), 'available', { date, startTime, endTime }] as const,
}

// Hook to fetch job orders with filters
export function useJobOrders(params?: {
  search?: string
  status?: string
  date?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: jobOrderKeys.list(params || {}),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.search) searchParams.append('search', params.search)
      if (params?.status && params.status !== 'all') searchParams.append('status', params.status)
      if (params?.date) searchParams.append('date', params.date)
      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.limit) searchParams.append('limit', params.limit.toString())

      const response = await fetch(`/api/job-orders?${searchParams.toString()}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch job orders')
      }
      
      const data = await response.json()
      
      // Sort job orders - important ones first, then carried over, then regular
      const sortedJobs = (data.jobOrders || []).sort((a: JobOrder, b: JobOrder) => {
        if (a.isImportant && !b.isImportant) return -1
        if (!a.isImportant && b.isImportant) return 1
        if (a.carriedOver && !b.carriedOver) return -1
        if (!a.carriedOver && b.carriedOver) return 1
        return 0
      })
      
      return {
        jobOrders: sortedJobs,
        pagination: data.pagination
      }
    },
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  })
}

// Hook to fetch a single job order
export function useJobOrder(id: string) {
  return useQuery({
    queryKey: jobOrderKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/job-orders/${id}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch job order')
      }
      
      const data = await response.json()
      return data.jobOrder as JobOrder
    },
    enabled: !!id,
  })
}

// Hook to fetch users/technicians
export function useUsers(filters?: { role?: string }) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const response = await fetch('/api/users', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      
      const data = await response.json()
      
      if (filters?.role === 'technician') {
        return {
          users: data.users?.filter((user: any) => user.role === 'technician') || []
        }
      }
      
      return data
    },
    staleTime: 10 * 60 * 1000, // Technicians don't change often, cache for 10 minutes
  })
}

// Hook to fetch available technicians
export function useAvailableTechnicians(date?: string, startTime?: string, endTime?: string) {
  return useQuery({
    queryKey: userKeys.available(date || '', startTime || '', endTime || ''),
    queryFn: async () => {
      const response = await fetch(
        `/api/job-orders/technicians/available?date=${date}&startTime=${startTime}&endTime=${endTime}`,
        {
          credentials: 'include'
        }
      )
      if (!response.ok) {
        throw new Error('Failed to fetch available technicians')
      }
      const data = await response.json()
      return data.technicians || []
    },
    enabled: !!date && !!startTime && !!endTime,
    staleTime: 1 * 60 * 1000, // 1 minute for availability
  })
}

// Hook to create a job order
export function useCreateJobOrder() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (jobOrderData: CreateJobOrderRequest) => {
      const response = await fetch('/api/job-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(jobOrderData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create job order')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate all job orders queries to refetch
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.available('', '', '') })
      toast.success('Job order created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Hook to update job order status
export function useUpdateJobOrderStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const response = await fetch(`/api/job-orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Your session has expired. Please log in again.')
          setTimeout(() => window.location.href = '/login', 1500)
          throw new Error('Session expired')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update job order status')
      }

      return response.json()
    },
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobOrderKeys.all })
      
      // Snapshot the previous value
      const previousJobOrders = queryClient.getQueriesData({ queryKey: jobOrderKeys.all })
      
      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: jobOrderKeys.all }, (old: any) => {
        if (!old) return old
        
        if (old.jobOrders) {
          return {
            ...old,
            jobOrders: old.jobOrders.map((job: JobOrder) => 
              job._id === id ? { ...job, status } : job
            )
          }
        }
        
        return old
      })
      
      return { previousJobOrders }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousJobOrders) {
        context.previousJobOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (error instanceof Error) {
        toast.error(error.message)
      }
    },
    onSuccess: () => {
      toast.success('Job status updated successfully')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
    },
  })
}

// Hook to update job order (generic)
export function useUpdateJobOrder() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const response = await fetch(`/api/job-orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Your session has expired. Please log in again.')
          setTimeout(() => window.location.href = '/login', 1500)
          throw new Error('Session expired')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update job order')
      }

      return response.json()
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobOrderKeys.all })
      
      // Snapshot the previous value
      const previousJobOrders = queryClient.getQueriesData({ queryKey: jobOrderKeys.all })
      
      // Optimistically update - skip optimistic update for complex changes like assignedTechnician
      // since it requires a full object but we only have the ID
      if (!updates.assignedTechnician) {
        queryClient.setQueriesData({ queryKey: jobOrderKeys.all }, (old: any) => {
          if (!old) return old
          
          if (old.jobOrders) {
            return {
              ...old,
              jobOrders: old.jobOrders.map((job: JobOrder) => 
                job._id === id ? { ...job, ...updates } : job
              )
            }
          }
          
          return old
        })
      }
      
      return { previousJobOrders }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousJobOrders) {
        context.previousJobOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (error instanceof Error) {
        toast.error(error.message)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.available('', '', '') })
    },
  })
}

// Hook to toggle important status
export function useToggleImportant() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/toggle-important`, {
        method: 'PATCH',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Your session has expired. Please log in again.')
          setTimeout(() => window.location.href = '/login', 1500)
          throw new Error('Session expired')
        }
        throw new Error('Failed to toggle important status')
      }

      return response.json()
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobOrderKeys.all })
      
      // Snapshot the previous value
      const previousJobOrders = queryClient.getQueriesData({ queryKey: jobOrderKeys.all })
      
      // Optimistically update
      queryClient.setQueriesData({ queryKey: jobOrderKeys.all }, (old: any) => {
        if (!old) return old
        
        if (old.jobOrders) {
          return {
            ...old,
            jobOrders: old.jobOrders.map((job: JobOrder) => 
              job._id === id ? { ...job, isImportant: !job.isImportant } : job
            )
          }
        }
        
        return old
      })
      
      return { previousJobOrders }
    },
    onError: (error, id, context) => {
      // Rollback on error
      if (context?.previousJobOrders) {
        context.previousJobOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Failed to toggle important status')
    },
    onSuccess: (data) => {
      toast.success(data.jobOrder.isImportant ? 'Job marked as important' : 'Job unmarked as important')
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
    },
  })
}

// Hook for QI actions
export function useSubmitForQI() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/submit-qi`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for QI')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      toast.success('Job order submitted for Quality Inspection')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit for QI')
    },
  })
}

export function useApproveQI() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/approve-qi`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to approve QI')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      toast.success('Job order approved and marked for release')
    },
    onError: () => {
      toast.error('Failed to approve QI')
    },
  })
}

export function useRejectQI() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/reject-qi`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to reject QI')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      toast.error('Job order rejected and marked for re-assessment')
    },
    onError: () => {
      toast.error('Failed to reject QI')
    },
  })
}

export function useCompleteJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/complete`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to complete job')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      toast.success('Job marked as Complete and released to customer')
    },
    onError: () => {
      toast.error('Failed to complete job')
    },
  })
}

export function useRedoJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/job-orders/${id}/redo`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to redo job')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobOrderKeys.all })
      toast.success('Job sent back for rework')
    },
    onError: () => {
      toast.error('Failed to redo job')
    },
  })
}

