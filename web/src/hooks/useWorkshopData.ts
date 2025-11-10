'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Appointment } from '@/types/appointment'
import {
  fetchWorkshopData,
  type WorkshopDataPayload,
  type JobOrderWithDetails,
} from '@/lib/workshopData'

interface UseWorkshopDataReturn {
  jobOrders: JobOrderWithDetails[]
  technicians: JobOrderWithDetails['assignedTechnician'][]
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
  loading: boolean
  updating: boolean
  refreshing: boolean
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

export function useWorkshopData(
  date: Date,
  initialData?: WorkshopDataPayload,
): UseWorkshopDataReturn {
  const [jobOrders, setJobOrders] = useState<JobOrderWithDetails[]>(
    initialData?.jobOrders ?? [],
  )
  const [technicians, setTechnicians] = useState<WorkshopDataPayload['technicians']>(
    initialData?.technicians ?? [],
  )
  const [qiJobs, setQiJobs] = useState<JobOrderWithDetails[]>(
    initialData?.qiJobs ?? [],
  )
  const [forReleaseJobs, setForReleaseJobs] = useState<JobOrderWithDetails[]>(
    initialData?.forReleaseJobs ?? [],
  )
  const [waitingPartsJobs, setWaitingPartsJobs] = useState<JobOrderWithDetails[]>(
    initialData?.waitingPartsJobs ?? [],
  )
  const [forPlottingJobs, setForPlottingJobs] = useState<JobOrderWithDetails[]>(
    initialData?.forPlottingJobs ?? [],
  )
  const [carriedOverJobs, setCarriedOverJobs] = useState<JobOrderWithDetails[]>(
    initialData?.carriedOverJobs ?? [],
  )
  const [holdCustomerJobs, setHoldCustomerJobs] = useState<JobOrderWithDetails[]>(
    initialData?.holdCustomerJobs ?? [],
  )
  const [holdWarrantyJobs, setHoldWarrantyJobs] = useState<JobOrderWithDetails[]>(
    initialData?.holdWarrantyJobs ?? [],
  )
  const [holdInsuranceJobs, setHoldInsuranceJobs] =
    useState<JobOrderWithDetails[]>(initialData?.holdInsuranceJobs ?? [])
  const [finishedUnclaimedJobs, setFinishedUnclaimedJobs] =
    useState<JobOrderWithDetails[]>(initialData?.finishedUnclaimedJobs ?? [])

  const [updating, setUpdating] = useState(false)
  const [isSnapshot, setIsSnapshot] = useState<boolean | undefined>(
    initialData?.isSnapshot,
  )

  const dateStr = useMemo(() => date.toISOString().split('T')[0], [date])
  const todayStr = useMemo(
    () => new Date().toISOString().split('T')[0],
    [],
  )
  const isHistoricalDate = dateStr < todayStr

  const workshopQuery = useQuery({
    queryKey: ['workshop-data', dateStr],
    queryFn: () => fetchWorkshopData(dateStr),
    initialData,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      if (isHistoricalDate) return false
      const data = query.state.data
      if (!data) return 15000
      return data.isSnapshot ? false : 15000
    },
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!workshopQuery.data) {
      return
    }

    const next = workshopQuery.data
    setJobOrders(next.jobOrders)
    setTechnicians(next.technicians)
    setQiJobs(next.qiJobs)
    setForReleaseJobs(next.forReleaseJobs)
    setWaitingPartsJobs(next.waitingPartsJobs)
    setForPlottingJobs(next.forPlottingJobs)
    setCarriedOverJobs(next.carriedOverJobs)
    setHoldCustomerJobs(next.holdCustomerJobs)
    setHoldWarrantyJobs(next.holdWarrantyJobs)
    setHoldInsuranceJobs(next.holdInsuranceJobs)
    setFinishedUnclaimedJobs(next.finishedUnclaimedJobs)
    setIsSnapshot(next.isSnapshot)
  }, [workshopQuery.data])

  const { data: appointmentsData } = useQuery({
    queryKey: ['workshop-appointments', dateStr],
    queryFn: async () => {
      const response = await fetch(`/api/appointments?date=${dateStr}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        return { appointments: [] }
      }
      const data = await response.json()
      return { appointments: data.appointments || [] }
    },
    enabled: !isHistoricalDate,
    staleTime: 0,
    refetchInterval: 5000,
  })

  const appointments = appointmentsData?.appointments || []
  const loading = workshopQuery.isLoading && !initialData
  const refreshing = workshopQuery.isFetching && !loading

  const fetchData = useCallback(async () => {
    await workshopQuery.refetch()
  }, [workshopQuery])

  return {
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
    loading,
    updating,
    refreshing,
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
    updateCarriedOverJobs: setCarriedOverJobs,
  }
}

export type { WorkshopDataPayload, JobOrderWithDetails } from '@/lib/workshopData'
