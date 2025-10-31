import { useCallback } from 'react'
import toast from 'react-hot-toast'
import type { JobOrder, User } from '@/types/jobOrder'

interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: User
  createdBy: User
}

interface UseJobActionsProps {
  jobOrders: JobOrderWithDetails[]
  selectedJob: JobOrderWithDetails | null
  updating: boolean
  setUpdating: (value: boolean) => void
  updateJobOrders: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateQiJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateForReleaseJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateWaitingPartsJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldCustomerJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldWarrantyJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldInsuranceJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateHoldFordJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateSubletJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateUnassignedJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  updateFinishedUnclaimedJobs: (updater: (prev: JobOrderWithDetails[]) => JobOrderWithDetails[]) => void
  setSelectedJob: (job: JobOrderWithDetails | null) => void
  fetchData: () => Promise<void>
}

export function useJobActions({
  jobOrders,
  selectedJob,
  updating,
  setUpdating,
  updateJobOrders,
  updateQiJobs,
  updateForReleaseJobs,
  updateWaitingPartsJobs,
  updateHoldCustomerJobs,
  updateHoldWarrantyJobs,
  updateHoldInsuranceJobs,
  updateHoldFordJobs,
  updateSubletJobs,
  updateUnassignedJobs,
  updateFinishedUnclaimedJobs,
  setSelectedJob,
  fetchData
}: UseJobActionsProps) {
  
  const getCurrentTime = useCallback((): string => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [])

  const toggleImportant = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      
      // Optimistic update
      const currentJob = jobOrders.find(job => job._id === jobId)
      if (!currentJob) return
      
      const newImportantStatus = !currentJob.isImportant
      updateJobOrders(prev => prev.map(job => 
        job._id === jobId ? { ...job, isImportant: newImportantStatus } : job
      ))
      if (selectedJob?._id === jobId) {
        setSelectedJob({ ...selectedJob, isImportant: newImportantStatus })
      }
      
      const response = await fetch(`/api/job-orders/${jobId}/toggle-important`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to toggle important status')
      
      toast.success(newImportantStatus ? 'Job marked as important' : 'Job unmarked as important')
    } catch (error) {
      console.error('Error toggling important:', error)
      toast.error('Failed to toggle important status')
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [jobOrders, selectedJob, updateJobOrders, setSelectedJob, fetchData, setUpdating])

  const updateJobStatus = useCallback(async (jobId: string, status: string, remarks?: string) => {
    try {
      setUpdating(true)
      
      const requestBody: any = { status }
      if (remarks !== undefined) {
        if (status === 'HC') {
          requestBody.holdCustomerRemarks = remarks
        } else if (status === 'SU') {
          requestBody.subletRemarks = remarks
        }
      }
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update job status')
      }
      
      const data = await response.json()
      const updatedJob = data.jobOrder
      
      // Remove from timetable if status is WP, HC, HW, HI, HF, SU, FU, or UA
      if (['WP', 'HC', 'HW', 'HI', 'HF', 'SU', 'FU', 'UA'].includes(status)) {
        updateJobOrders(prev => prev.filter(job => job._id !== jobId))
      } else {
        // Update in timetable for other statuses
        updateJobOrders(prev => prev.map(job => 
          job._id === jobId ? updatedJob : job
        ))
      }
      
      // Update selected job if it's the one being updated
      if (selectedJob?._id === jobId) {
        setSelectedJob(updatedJob)
      }
      
      // Update all status lists
      updateQiJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'QI' ? [...filtered, updatedJob] : filtered
      })
      
      updateForReleaseJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'FR' ? [...filtered, updatedJob] : filtered
      })
      
      updateWaitingPartsJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'WP' ? [...filtered, updatedJob] : filtered
      })
      
      updateHoldCustomerJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HC' ? [...filtered, updatedJob] : filtered
      })
      
      updateHoldWarrantyJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HW' ? [...filtered, updatedJob] : filtered
      })
      
      updateHoldInsuranceJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HI' ? [...filtered, updatedJob] : filtered
      })
      
      updateHoldFordJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HF' ? [...filtered, updatedJob] : filtered
      })
      
      updateSubletJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'SU' ? [...filtered, updatedJob] : filtered
      })
      
      updateUnassignedJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'UA' ? [...filtered, updatedJob] : filtered
      })
      
      updateFinishedUnclaimedJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'FU' ? [...filtered, updatedJob] : filtered
      })
      
      toast.success('Job status updated successfully')
    } catch (error) {
      console.error('Error updating job status:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to update job status')
      }
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, updateJobOrders, updateQiJobs, updateForReleaseJobs, updateWaitingPartsJobs, updateHoldCustomerJobs, updateHoldWarrantyJobs, updateHoldInsuranceJobs, updateFinishedUnclaimedJobs, setSelectedJob, fetchData, setUpdating])

  const updateTaskStatus = useCallback(async (jobId: string, taskIndex: number, status: 'Finished' | 'Unfinished') => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const updatedJobList = [...selectedJob.jobList]
      updatedJobList[taskIndex].status = status
      
      // Optimistic update
      updateJobOrders(prev => prev.map(job => 
        job._id === jobId ? { ...job, jobList: updatedJobList } : job
      ))
      setSelectedJob({ ...selectedJob, jobList: updatedJobList })
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobList: updatedJobList })
      })
      if (!response.ok) throw new Error('Failed to update task status')
      
      toast.success(`Task marked as ${status.toLowerCase()}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, updateJobOrders, setSelectedJob, fetchData, setUpdating])

  const updatePartAvailability = useCallback(async (jobId: string, partIndex: number, availability: 'Available' | 'Unavailable') => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const updatedParts = [...selectedJob.parts]
      updatedParts[partIndex].availability = availability
      
      // If parts became unavailable and job is currently on going, set actual end time
      const hasUnavailableParts = updatedParts.some(part => part.availability === 'Unavailable')
      const wasOnGoing = selectedJob.status === 'OG'
      const currentTime = getCurrentTime()
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parts: updatedParts,
          ...(hasUnavailableParts && wasOnGoing && availability === 'Unavailable' ? { actualEndTime: currentTime } : {})
        })
      })
      if (!response.ok) throw new Error('Failed to update part availability')
      
      const data = await response.json()
      const updatedJobOrder = data.jobOrder
      setSelectedJob(updatedJobOrder)
      
      toast.success(`Part marked as ${availability.toLowerCase()}`)
      
      // Check if all parts are now available and status changed to UA
      const allPartsAvailable = updatedParts.every(part => part.availability === 'Available')
      const wasWaitingParts = selectedJob.status === 'WP'
      const nowUnassigned = updatedJobOrder.status === 'UA'
      
      if (allPartsAvailable && wasWaitingParts && nowUnassigned) {
        toast.success('All parts are now available! Status changed to "Unassigned". Use the Replot button to assign a technician and time slot.', { duration: 7000 })
      }
      
      await fetchData()
    } catch (error) {
      console.error('Error updating part availability:', error)
      toast.error('Failed to update part availability')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, getCurrentTime, setSelectedJob, fetchData, setUpdating])

  const submitForQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const currentTime = getCurrentTime()
      // Optimistic: move job from timetable to QI list immediately
      updateJobOrders(prev => prev.filter(job => job._id !== jobId))
      updateQiJobs(prev => {
        // If selectedJob is the one, clone with status QI
        const optimistic = selectedJob && selectedJob._id === jobId
          ? { ...selectedJob, status: 'QI' as any }
          : undefined
        return optimistic ? [...prev, optimistic as any] : prev
      })

      const response = await fetch(`/api/job-orders/${jobId}/submit-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for QI')
      }
      
      await fetchData()
      toast.success('Job order submitted for Quality Inspection')
    } catch (error: any) {
      console.error('Error submitting for QI:', error)
      toast.error(error.message || 'Failed to submit for QI')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, getCurrentTime, fetchData, setUpdating])

  const approveQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      // Optimistic: move from QI to For Release
      let movedJob: any = null
      updateQiJobs(prev => {
        const job = prev.find(j => j._id === jobId)
        if (job) {
          movedJob = { ...job, status: 'FR' as any }
        }
        return prev.filter(j => j._id !== jobId)
      })
      if (movedJob) {
        updateForReleaseJobs(prev => [movedJob, ...prev])
      }

      const response = await fetch(`/api/job-orders/${jobId}/approve-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to approve QI')
      await fetchData()
      toast.success('Job order approved and marked for release')
    } catch (error) {
      console.error('Error approving QI:', error)
      toast.error('Failed to approve QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData, setUpdating])

  const rejectQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      // Optimistic: remove from QI list
      updateQiJobs(prev => prev.filter(job => job._id !== jobId))

      const response = await fetch(`/api/job-orders/${jobId}/reject-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to reject QI')
      await fetchData()
      toast.error('Job order rejected and sent to Unassigned')
    } catch (error) {
      console.error('Error rejecting QI:', error)
      toast.error('Failed to reject QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData, setUpdating])

  const completeJob = useCallback(async (jobId: string, isClaimed: boolean) => {
    try {
      setUpdating(true)
      
      // If claimed, we need to transition from FR -> FU -> CP
      // First, move from FR to FU, then from FU to CP
      if (isClaimed) {
        // Step 1: Move from FR to FU (Finished Unclaimed)
        const completeResponse = await fetch(`/api/job-orders/${jobId}/complete`, {
          method: 'PATCH'
        })
        if (!completeResponse.ok) {
          const errorData = await completeResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to complete job')
        }
        
        // Step 2: Move from FU to CP (Complete)
        const markCompleteResponse = await fetch(`/api/job-orders/${jobId}/mark-complete`, {
          method: 'PATCH'
        })
        if (!markCompleteResponse.ok) {
          const errorData = await markCompleteResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to mark job as complete')
        }
        
        // Remove from For Release list immediately
        updateForReleaseJobs(prev => prev.filter(job => job._id !== jobId))
        
        await fetchData()
        toast.success('Job marked as Complete and released to customer')
      } else {
        // If not claimed, mark as finished unclaimed (FR -> FU)
        const response = await fetch(`/api/job-orders/${jobId}/complete`, {
          method: 'PATCH'
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to complete job')
        }
        
        // Remove from For Release list immediately
        updateForReleaseJobs(prev => prev.filter(job => job._id !== jobId))
        
        await fetchData()
        toast.success('Job marked as Finished Unclaimed')
      }
    } catch (error) {
      console.error('Error completing job:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete job'
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }, [fetchData, updateForReleaseJobs, setUpdating])

  const redoJob = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      // Optimistic: move from For Release back to QI
      let movedJob: any = null
      updateForReleaseJobs(prev => {
        const job = prev.find(j => j._id === jobId)
        if (job) {
          movedJob = { ...job, status: 'QI' as any }
        }
        return prev.filter(j => j._id !== jobId)
      })
      if (movedJob) {
        updateQiJobs(prev => [movedJob, ...prev])
      }

      const response = await fetch(`/api/job-orders/${jobId}/redo`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to redo job')
      await fetchData()
      toast.success('Job sent back to Quality Inspection')
    } catch (error) {
      console.error('Error redoing job:', error)
      toast.error('Failed to redo job')
    } finally {
      setUpdating(false)
    }
  }, [fetchData, setUpdating])

  const markComplete = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/job-orders/${jobId}/mark-complete`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to mark job as complete')
      
      // Remove from Finished Unclaimed list immediately
      updateFinishedUnclaimedJobs(prev => prev.filter(job => job._id !== jobId))
      
      await fetchData()
      toast.success('Job marked as Complete and released to customer')
    } catch (error) {
      console.error('Error marking job as complete:', error)
      toast.error('Failed to mark job as complete')
    } finally {
      setUpdating(false)
    }
  }, [fetchData, updateFinishedUnclaimedJobs, setUpdating])

  return {
    toggleImportant,
    updateJobStatus,
    updateTaskStatus,
    updatePartAvailability,
    submitForQI,
    approveQI,
    rejectQI,
    completeJob,
    redoJob,
    markComplete,
    getCurrentTime
  }
}
