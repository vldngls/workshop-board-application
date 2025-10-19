import { useState, useEffect, useCallback } from 'react'
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
  const [appointments, setAppointments] = useState<Appointment[]>([])
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      const dateStr = date.toISOString().split('T')[0]
      
      // Fetch all data in parallel
      const [
        jobOrdersResponse,
        techniciansResponse,
        qiResponse,
        frResponse,
        wpResponse,
        fpResponse,
        hcResponse,
        hwResponse,
        hiResponse,
        fuResponse,
        carriedOverResponse,
        appointmentsResponse
      ] = await Promise.all([
        fetch(`/api/job-orders?date=${dateStr}`),
        fetch('/api/users'),
        fetch('/api/job-orders?status=QI'),
        fetch('/api/job-orders?status=FR'),
        fetch('/api/job-orders?status=WP'),
        fetch('/api/job-orders?status=FP'),
        fetch('/api/job-orders?status=HC'),
        fetch('/api/job-orders?status=HW'),
        fetch('/api/job-orders?status=HI'),
        fetch('/api/job-orders?status=FU'),
        fetch('/api/job-orders'), // Fetch all carry-over jobs regardless of date
        fetch(`/api/appointments?date=${dateStr}`).catch(() => ({ ok: false }))
      ])

      // Process responses
      const jobOrdersData = await jobOrdersResponse.json()
      const techniciansData = await techniciansResponse.json()
      const qiData = await qiResponse.json()
      const frData = await frResponse.json()
      const wpData = await wpResponse.json()
      const fpData = await fpResponse.json()
      const hcData = await hcResponse.json()
      const hwData = await hwResponse.json()
      const hiData = await hiResponse.json()
      const fuData = await fuResponse.json()
      const carriedOverData = await carriedOverResponse.json()

      // Filter and sort data
      const pendingQI = (qiData.jobOrders || []).filter((job: JobOrderWithDetails) => job.qiStatus === 'pending')
      const forRelease = frData.jobOrders || []
      const waitingParts = wpData.jobOrders || []
      const forPlotting = fpData.jobOrders || []
      const holdCustomer = hcData.jobOrders || []
      const holdWarranty = hwData.jobOrders || []
      const holdInsurance = hiData.jobOrders || []
      const finishedUnclaimed = fuData.jobOrders || []
      const carriedOver = (carriedOverData.jobOrders || []).filter((job: JobOrderWithDetails) => 
        job.carriedOver && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP'
      )

      // Filter timetable jobs (exclude statuses that should only appear in sections below)
      const timetableJobs = (jobOrdersData.jobOrders || []).filter((job: JobOrderWithDetails) => 
        !['WP', 'HC', 'HW', 'HI', 'FU'].includes(job.status)
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

      // Handle appointments separately since it might fail
      if (appointmentsResponse.ok) {
        const appointmentsData = await (appointmentsResponse as Response).json()
        setAppointments(appointmentsData.appointments || [])
      } else {
        setAppointments([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [date])

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
