/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { JobOrder, User } from '@/types/jobOrder'
import type { Appointment } from '@/types/appointment'

interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: User
  createdBy: User
}

interface UseWorkshopDataReturn {
  // Data
  jobOrders: JobOrderWithDetails[]
  technicians: User[]
  appointments: Appointment[]
  qiJobs: JobOrderWithDetails[]
  forReleaseJobs: JobOrderWithDetails[]
  waitingPartsJobs: JobOrderWithDetails[]
  forPlottingJobs: JobOrderWithDetails[]
  carriedOverJobs: JobOrderWithDetails[]
  holdCustomerJobs: JobOrderWithDetails[]
  holdWarrantyJobs: JobOrderWithDetails[]
  holdInsuranceJobs: JobOrderWithDetails[]
  finishedUnclaimedJobs: JobOrderWithDetails[]
  isSnapshot?: boolean
  
  // State
  loading: boolean
  updating: boolean
  refreshing: boolean
  
  // Actions
  fetchData: () => Promise<void>
  setUpdating: (value: boolean) => void
  updateJobOrders: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateQiJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateForReleaseJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateWaitingPartsJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldCustomerJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldWarrantyJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldInsuranceJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateFinishedUnclaimedJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateCarriedOverJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
}

export function useWorkshopData(date: Date): UseWorkshopDataReturn {
  const queryClient = useQueryClient()
  const [jobOrders, setJobOrders] = useState<JobOrderWithDetails[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [qiJobs, setQiJobs] = useState<JobOrderWithDetails[]>([])
  const [forReleaseJobs, setForReleaseJobs] = useState<JobOrderWithDetails[]>([])
  const [waitingPartsJobs, setWaitingPartsJobs] = useState<JobOrderWithDetails[]>([])
  const [forPlottingJobs, setForPlottingJobs] = useState<JobOrderWithDetails[]>([])
  const [carriedOverJobs, setCarriedOverJobs] = useState<JobOrderWithDetails[]>([])
  const [holdCustomerJobs, setHoldCustomerJobs] = useState<JobOrderWithDetails[]>([])
  const [holdWarrantyJobs, setHoldWarrantyJobs] = useState<JobOrderWithDetails[]>([])
  const [holdInsuranceJobs, setHoldInsuranceJobs] = useState<JobOrderWithDetails[]>([])
  const [finishedUnclaimedJobs, setFinishedUnclaimedJobs] = useState<JobOrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [isSnapshot, setIsSnapshot] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const initialLoadRef = useRef(true)
  const techniciansLoadedRef = useRef(false)
  const snapshotStatusRef = useRef<Record<string, 'missing' | 'available'>>({})

  const dateStr = date.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]
  const isHistoricalDate = dateStr < todayStr

  // Use React Query for appointments so it auto-updates when appointments change
  const { data: appointmentsData } = useQuery({
    queryKey: ['workshop-appointments', dateStr],
    queryFn: async () => {
      const response = await fetch(`/api/appointments?date=${dateStr}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        return { appointments: [] }
      }
      const data = await response.json()
      return { appointments: data.appointments || [] }
    },
    enabled: !isHistoricalDate, // Only fetch for current/future dates, not historical
    staleTime: 0, // Always refetch to get latest appointments
    refetchInterval: 5000, // Refetch every 5 seconds to catch cross-tab changes
  })

  const appointments = appointmentsData?.appointments || []

  const fetchData = useCallback(async () => {
    try {
      const isInitialLoad = initialLoadRef.current
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      
      // Check for snapshot for ANY date (including today if snapshot exists)
      // Skip repeated 404 lookups by remembering missing snapshots
      let snapshotRes: Response | null = null
      const cachedSnapshotStatus = snapshotStatusRef.current[dateStr]
      if (cachedSnapshotStatus !== 'missing') {
        snapshotRes = await fetch(`/api/job-orders/snapshot/${dateStr}`, { credentials: 'include' })
          .catch(() => null)
      }

      if (snapshotRes?.ok) {
        snapshotStatusRef.current[dateStr] = 'available'
        const snapshotData = await snapshotRes.json()
        const snapJobs = (snapshotData?.snapshot?.jobOrders || snapshotData?.jobOrders || []) as any[]
        // Map snapshot jobs to JobOrderWithDetails shape used by the timetable
        const mapped = snapJobs.map((job: any) => ({
          _id: job._id,
          jobNumber: job.jobNumber,
          createdBy: job.createdBy,
          assignedTechnician: job.assignedTechnician || undefined,
          serviceAdvisor: job.serviceAdvisor || undefined,
          plateNumber: job.plateNumber,
          vin: job.vin,
          timeRange: job.timeRange,
          actualEndTime: job.actualEndTime,
          jobList: job.jobList || [],
          parts: job.parts || [],
          status: job.status,
          date: typeof job.date === 'string' ? job.date : new Date(job.date).toISOString().split('T')[0],
          originalCreatedDate: job.originalCreatedDate,
          sourceType: job.sourceType,
          carriedOver: !!job.carriedOver,
          isImportant: !!job.isImportant,
          qiStatus: job.qiStatus,
          holdCustomerRemarks: job.holdCustomerRemarks,
          subletRemarks: job.subletRemarks,
          originalJobId: job.originalJobId,
          carryOverChain: job.carryOverChain,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        })) as unknown as JobOrderWithDetails[]

        // For snapshots, filter jobs that should appear on timetable
        // Include jobs with assigned technicians and proper time ranges
        // This preserves the "screenshot" - showing jobs as they were on the timetable
        const snapshotTimetableJobs = mapped.filter((job: any) => 
          job.assignedTechnician &&
          job.timeRange?.start &&
          job.timeRange?.end &&
          job.timeRange.start !== '00:00' &&
          job.timeRange.end !== '00:00'
        )
        
        setJobOrders(snapshotTimetableJobs)
        // still show technicians list to render timetable rows
        if (!techniciansLoadedRef.current) {
          try {
            const usersRes = await fetch('/api/users', { credentials: 'include' })
            if (usersRes.ok) {
              const usersData = await usersRes.json()
              setTechnicians(usersData.users?.filter((u: any) => u.role === 'technician') || [])
              techniciansLoadedRef.current = true
            } else {
              setTechnicians([])
            }
          } catch {
            setTechnicians([])
          }
        }
        // Appointments are handled by React Query, skip for snapshots

        // Use optimized endpoint to fetch queues by status
        try {
          const queuesRes = await fetch('/api/job-orders/queues/by-status?statuses=QI,FR,WP,UA,HC,HW,HI,FU,carriedOver&limit=100', {
            credentials: 'include'
          })
          if (queuesRes.ok) {
            const queuesData = await queuesRes.json()
            const queues = queuesData.queues || {}
            
            setQiJobs((queues.QI || []) as any)
            setForReleaseJobs((queues.FR || []) as any)
            setWaitingPartsJobs((queues.WP || []) as any)
            setForPlottingJobs((queues.UA || []) as any)
            setHoldCustomerJobs((queues.HC || []) as any)
            setHoldWarrantyJobs((queues.HW || []) as any)
            setHoldInsuranceJobs((queues.HI || []) as any)
            setFinishedUnclaimedJobs((queues.FU || []) as any)
            setCarriedOverJobs((queues.carriedOver || []) as any)
          } else {
            // Fallback to snapshot-derived queues if optimized endpoint fails
            const pendingQI = mapped.filter((job: any) => job.status === 'QI' && job.qiStatus === 'pending')
            const forRelease = mapped.filter((job: any) => job.status === 'FR')
            const waitingParts = mapped.filter((job: any) => job.status === 'WP')
            const forPlotting = mapped.filter((job: any) => job.status === 'UA')
            const holdCustomer = mapped.filter((job: any) => job.status === 'HC')
            const holdWarranty = mapped.filter((job: any) => job.status === 'HW')
            const holdInsurance = mapped.filter((job: any) => job.status === 'HI')
            const finishedUnclaimed = mapped.filter((job: any) => job.status === 'FU')
            const carriedOver = mapped.filter((job: any) => job.carriedOver && !['FR','FU','CP'].includes(job.status))
            setQiJobs(pendingQI as any)
            setForReleaseJobs(forRelease as any)
            setWaitingPartsJobs(waitingParts as any)
            setForPlottingJobs(forPlotting as any)
            setHoldCustomerJobs(holdCustomer as any)
            setHoldWarrantyJobs(holdWarranty as any)
            setHoldInsuranceJobs(holdInsurance as any)
            setFinishedUnclaimedJobs(finishedUnclaimed as any)
            setCarriedOverJobs(carriedOver as any)
          }
        } catch {
          // Final fallback to snapshot-derived queues
          const pendingQI = mapped.filter((job: any) => job.status === 'QI' && job.qiStatus === 'pending')
          const forRelease = mapped.filter((job: any) => job.status === 'FR')
          const waitingParts = mapped.filter((job: any) => job.status === 'WP')
          const forPlotting = mapped.filter((job: any) => job.status === 'UA')
          const holdCustomer = mapped.filter((job: any) => job.status === 'HC')
          const holdWarranty = mapped.filter((job: any) => job.status === 'HW')
          const holdInsurance = mapped.filter((job: any) => job.status === 'HI')
          const finishedUnclaimed = mapped.filter((job: any) => job.status === 'FU')
          const carriedOver = mapped.filter((job: any) => job.carriedOver && !['FR','FU','CP'].includes(job.status))
          setQiJobs(pendingQI as any)
          setForReleaseJobs(forRelease as any)
          setWaitingPartsJobs(waitingParts as any)
          setForPlottingJobs(forPlotting as any)
          setHoldCustomerJobs(holdCustomer as any)
          setHoldWarrantyJobs(holdWarranty as any)
          setHoldInsuranceJobs(holdInsurance as any)
          setFinishedUnclaimedJobs(finishedUnclaimed as any)
          setCarriedOverJobs(carriedOver as any)
        }
        setIsSnapshot(true)
        setLoading(false)
        setRefreshing(false)
        initialLoadRef.current = false
        return
      } else if (snapshotRes && snapshotRes.status === 404) {
        snapshotStatusRef.current[dateStr] = 'missing'
      }
      
      // If no snapshot found, proceed with live data fetch
      setIsSnapshot(false)

      // Fetch optimized data in parallel (live view)
      // Use optimized endpoint for status queues instead of fetching all jobs
      const [jobOrdersResponse, queuesResponse, techniciansResponse] = await Promise.all([
        fetch(`/api/job-orders?date=${dateStr}&limit=500`, { credentials: 'include' }), // date-specific for timetable (reduced limit)
        fetch('/api/job-orders/queues/by-status?statuses=QI,FR,WP,UA,HC,HW,HI,FU,carriedOver&limit=100', { credentials: 'include' }), // Optimized queues endpoint
        techniciansLoadedRef.current
          ? Promise.resolve(null as Response | null)
          : fetch('/api/users', { credentials: 'include' })
      ])

      // Process responses
      const jobOrdersData = await jobOrdersResponse.json()
      
      // Parse optimized queues response
      let queues: Record<string, JobOrderWithDetails[]> = {}
      if (queuesResponse.ok) {
        const queuesData = await queuesResponse.json()
        queues = queuesData.queues || {}
      }

      if (techniciansResponse) {
        if (techniciansResponse.ok) {
          const techniciansData = await techniciansResponse.json()
          setTechnicians(techniciansData.users?.filter((user: any) => user.role === 'technician') || [])
          techniciansLoadedRef.current = true
        } else {
          setTechnicians([])
        }
      }

      // Appointments are now handled by React Query above

      // Use optimized queues or fallback to filtering if endpoint failed
      const pendingQI = queues.QI || []
      const forRelease = queues.FR || []
      const waitingParts = queues.WP || []
      const forPlotting = queues.UA || []
      const holdCustomer = queues.HC || []
      const holdWarranty = queues.HW || []
      const holdInsurance = queues.HI || []
      const finishedUnclaimed = queues.FU || []
      const carriedOver = queues.carriedOver || []

      // Filter timetable jobs (exclude statuses that should only appear in sections below)
      // Include jobs that are assigned to technicians and have proper time ranges
      const baseJobsForDate = jobOrdersData.jobOrders || []
      const carryOverForTimetable = (carriedOver as JobOrderWithDetails[]).filter((job) => {
        const jobDate = typeof job.date === 'string' ? job.date : new Date(job.date).toISOString().split('T')[0]
        return jobDate === dateStr &&
          job.assignedTechnician &&
          job.timeRange?.start &&
          job.timeRange?.end &&
          job.timeRange.start !== '00:00' &&
          job.timeRange.end !== '00:00'
      })

      const mergedJobsMap = new Map<string, JobOrderWithDetails>()
      baseJobsForDate.forEach((job: JobOrderWithDetails) => mergedJobsMap.set(String(job._id), job))
      carryOverForTimetable.forEach((job: JobOrderWithDetails) => {
        const key = String(job._id)
        if (!mergedJobsMap.has(key)) {
          mergedJobsMap.set(key, job)
        }
      })
      const allJobsForDate = Array.from(mergedJobsMap.values())
      
      // Keep all jobs on timetable but filter out jobs without proper time assignments
      const timetableJobs = allJobsForDate.filter((job: JobOrderWithDetails) => 
        job.assignedTechnician &&
        job.timeRange.start !== '00:00' &&
        job.timeRange.end !== '00:00'
      )
      
      

      // Sort job orders - important ones first, then carried over, then by date
      const sortedJobs = timetableJobs.sort((a: JobOrderWithDetails, b: JobOrderWithDetails) => {
        if (a.isImportant && !b.isImportant) return -1
        if (!a.isImportant && b.isImportant) return 1
        if (a.carriedOver && !b.carriedOver) return -1
        if (!a.carriedOver && b.carriedOver) return 1
        return 0
      })

      // Set all state
      setJobOrders(sortedJobs)
      setQiJobs(pendingQI)
      setForReleaseJobs(forRelease)
      setWaitingPartsJobs(waitingParts)
      setForPlottingJobs(forPlotting)
      setHoldCustomerJobs(holdCustomer)
      setHoldWarrantyJobs(holdWarranty)
      setHoldInsuranceJobs(holdInsurance)
      setFinishedUnclaimedJobs(finishedUnclaimed)
      setCarriedOverJobs(carriedOver)
      setIsSnapshot(false)

      // Appointments are now handled by React Query above, no need to set state here
      } catch {
      // Error fetching data - silently fail to avoid console noise
    } finally {
      setLoading(false)
      setRefreshing(false)
      initialLoadRef.current = false
    }
  }, [dateStr])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Listen for query invalidations and mutations to trigger refetch
  useEffect(() => {
    let refetchTimeout: NodeJS.Timeout | null = null
    
    // Debounced refetch function to avoid multiple rapid refetches
    const debouncedRefetch = () => {
      if (refetchTimeout) {
        clearTimeout(refetchTimeout)
      }
      refetchTimeout = setTimeout(() => {
        fetchData()
      }, 500)
    }

    // Subscribe to mutation cache to detect when mutations succeed
    const mutationUnsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event?.type === 'updated' && event?.mutation?.state?.status === 'success') {
        const mutationKey = event.mutation.options.mutationKey
        const mutationFn = event.mutation.options.mutationFn
        
        // Check if this is a job order or appointment related mutation
        const hasRelevantKey = mutationKey && Array.isArray(mutationKey) && 
          mutationKey.some((key: any) => 
            typeof key === 'string' && 
            (key.toLowerCase().includes('job') || key.toLowerCase().includes('appointment'))
          )
        
        const hasRelevantFn = mutationFn && typeof mutationFn === 'function' && 
          (mutationFn.toString().toLowerCase().includes('job-order') ||
           mutationFn.toString().toLowerCase().includes('appointment'))
        
        const isRelevant = hasRelevantKey || hasRelevantFn
        
        if (isRelevant) {
          debouncedRefetch()
        }
      }
    })

    // Subscribe to query cache to detect when queries are invalidated
    const queryUnsubscribe = queryClient.getQueryCache().subscribe((event) => {
      try {
        // Only listen for query removal events (which happen on invalidation)
        if (event?.type === 'removed' && event?.query) {
          const queryKey = event.query.queryKey
          if (
            queryKey &&
            Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === 'string' &&
            (
              queryKey[0] === 'jobOrders' ||
              queryKey[0] === 'workshop-appointments' ||
              queryKey[0] === 'appointments' ||
              queryKey[0] === 'technician-schedule' ||
              queryKey[0] === 'workshop-slots'
            )
          ) {
            debouncedRefetch()
          }
        }
      } catch {
        // Silently ignore errors in query cache subscription
        // This can happen if React Query internals change
      }
    })

    // Also refetch periodically to catch changes from other tabs/windows
    const interval = setInterval(() => {
      if (!isHistoricalDate) {
        fetchData()
      }
    }, 15000) // Refetch every 15 seconds for live data (less aggressive than before)

    return () => {
      mutationUnsubscribe()
      queryUnsubscribe()
      clearInterval(interval)
      if (refetchTimeout) {
        clearTimeout(refetchTimeout)
      }
    }
  }, [queryClient, fetchData, isHistoricalDate])

  return {
    // Data
    jobOrders,
    technicians,
    appointments,
    qiJobs,
    forReleaseJobs,
    waitingPartsJobs,
    forPlottingJobs,
    carriedOverJobs,
    holdCustomerJobs,
    holdWarrantyJobs,
    holdInsuranceJobs,
    finishedUnclaimedJobs,
    isSnapshot,
    
    // State
    loading,
    updating,
    refreshing,
    
    // Actions
    fetchData,
    setUpdating,
    updateJobOrders: setJobOrders,
    updateQiJobs: setQiJobs,
    updateForReleaseJobs: setForReleaseJobs,
    updateWaitingPartsJobs: setWaitingPartsJobs,
    updateHoldCustomerJobs: setHoldCustomerJobs,
    updateHoldWarrantyJobs: setHoldWarrantyJobs,
    updateHoldInsuranceJobs: setHoldInsuranceJobs,
    updateFinishedUnclaimedJobs: setFinishedUnclaimedJobs,
    updateCarriedOverJobs: setCarriedOverJobs
  }
}
