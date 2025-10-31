import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
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
}

export function useWorkshopData(date: Date): UseWorkshopDataReturn {
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
      setLoading(true)
      
      const shouldCheckSnapshot = isHistoricalDate // only check snapshots for past dates
      
      // First, check for a saved snapshot for the date
      if (shouldCheckSnapshot) {
        const snapshotRes = await fetch(`/api/job-orders/snapshot/${dateStr}`).catch(() => ({ ok: false, status: 404 } as any))
        if (snapshotRes.ok) {
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

          setJobOrders(mapped)
          // still show technicians list to render timetable rows
          try {
            const usersRes = await fetch('/api/users')
            if (usersRes.ok) {
              const usersData = await usersRes.json()
              setTechnicians(usersData.users?.filter((u: any) => u.role === 'technician') || [])
            } else {
              setTechnicians([])
            }
          } catch {
            setTechnicians([])
          }
          // Appointments are handled by React Query, skip for snapshots

          // Derive queues from ALL jobs (global, not date-specific) for consistent sections
          try {
            const allJobsRes = await fetch('/api/job-orders?limit=1000')
            if (allJobsRes.ok) {
              const allJobsData = await allJobsRes.json()
              const allJobs = (allJobsData.jobOrders || []) as JobOrderWithDetails[]

              const pendingQI = allJobs.filter((job: any) => job.status === 'QI' && job.qiStatus === 'pending')
              const forRelease = allJobs.filter((job: any) => job.status === 'FR')
              const waitingParts = allJobs.filter((job: any) => job.status === 'WP')
              const forPlotting = allJobs.filter((job: any) => job.status === 'UA')
              const holdCustomer = allJobs.filter((job: any) => job.status === 'HC')
              const holdWarranty = allJobs.filter((job: any) => job.status === 'HW')
              const holdInsurance = allJobs.filter((job: any) => job.status === 'HI')
              const finishedUnclaimed = allJobs.filter((job: any) => job.status === 'FU')
              const carriedOver = allJobs.filter((job: any) => job.carriedOver && !['FR','FU','CP'].includes(job.status))

              setQiJobs(pendingQI as any)
              setForReleaseJobs(forRelease as any)
              setWaitingPartsJobs(waitingParts as any)
              setForPlottingJobs(forPlotting as any)
              setHoldCustomerJobs(holdCustomer as any)
              setHoldWarrantyJobs(holdWarranty as any)
              setHoldInsuranceJobs(holdInsurance as any)
              setFinishedUnclaimedJobs(finishedUnclaimed as any)
              setCarriedOverJobs(carriedOver as any)
            } else {
              // Fallback to snapshot-derived queues if global fetch fails
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
          return
        }
      } else {
        setIsSnapshot(false)
      }

      // Fetch minimal set in parallel (live view)
      // Add cache-busting timestamp to ensure fresh data after reassignments
      const cacheBuster = `&_t=${Date.now()}`
      const [jobOrdersResponse, techniciansResponse, carriedOverResponse, allJobsResponse] = await Promise.all([
        fetch(`/api/job-orders?date=${dateStr}&limit=1000${cacheBuster}`), // date-specific for timetable
        fetch('/api/users'),
        fetch(`/api/job-orders?carriedOver=true&limit=1000${cacheBuster}`),
        fetch(`/api/job-orders?limit=1000${cacheBuster}`) // global for status queues
      ])

      // Process responses
      const jobOrdersData = await jobOrdersResponse.json()
      const techniciansData = await techniciansResponse.json()
      const carriedOverData = await carriedOverResponse.json()
      const allJobsData = allJobsResponse.ok ? await allJobsResponse.json() : { jobOrders: [] }

      // Appointments are now handled by React Query above

      // Derive category lists from ALL jobs (global) for consistent status queues
      const allJobs = (allJobsData.jobOrders || []) as JobOrderWithDetails[]
      const pendingQI = allJobs.filter((job: JobOrderWithDetails) => job.status === 'QI' && job.qiStatus === 'pending')
      const forRelease = allJobs.filter((job: JobOrderWithDetails) => job.status === 'FR')
      const waitingParts = allJobs.filter((job: JobOrderWithDetails) => job.status === 'WP')
      const forPlotting = allJobs.filter((job: JobOrderWithDetails) => job.status === 'UA')
      const holdCustomer = allJobs.filter((job: JobOrderWithDetails) => job.status === 'HC')
      const holdWarranty = allJobs.filter((job: JobOrderWithDetails) => job.status === 'HW')
      const holdInsurance = allJobs.filter((job: JobOrderWithDetails) => job.status === 'HI')
      const finishedUnclaimed = allJobs.filter((job: JobOrderWithDetails) => job.status === 'FU')
      const carriedOver = allJobs.filter((job: JobOrderWithDetails) =>
        job.carriedOver && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP'
      )

      // Filter timetable jobs (exclude statuses that should only appear in sections below)
      // Include jobs that are assigned to technicians and have proper time ranges
      // Combine jobs from date-specific fetch and carry-over jobs that might be reassigned to this date
      const allJobsForDate = [
        ...(jobOrdersData.jobOrders || []),
        ...(carriedOverData.jobOrders || []).filter((job: JobOrderWithDetails) => job.date === dateStr)
      ]
      
      
      
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
      setTechnicians(techniciansData.users?.filter((user: any) => user.role === 'technician') || [])
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
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [date, dateStr, isHistoricalDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    updateFinishedUnclaimedJobs: setFinishedUnclaimedJobs
  }
}
