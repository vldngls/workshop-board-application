'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import type { Appointment, CreateAppointmentRequest } from "@/types/appointment"
import CreateJobOrderFromAppointmentModal from '@/components/CreateJobOrderFromAppointmentModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import TechnicianScheduleView from '@/components/TechnicianScheduleView'

interface Technician {
  _id: string
  name: string
  email: string
  level: string
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient()
  const plateInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  
  const [formData, setFormData] = useState({
    technician: '',
    plateNumber: '',
    startTime: '07:00',
    duration: 300 // Duration in minutes (default 5 hours)
  })

  // Calculate end time based on start time and duration
  const calculateEndTime = (start: string, durationMinutes: number): string => {
    const [hours, minutes] = start.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  const endTime = calculateEndTime(formData.startTime, formData.duration)

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCreateJobOrderModal, setShowCreateJobOrderModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)

  // Fetch technicians
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const res = await fetch(`/api/users?role=technician`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch technicians')
      return res.json() as Promise<{ users: Technician[] }>
    }
  })

  // Fetch appointments for selected date
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ['appointments', selectedDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments?date=${selectedDate}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch appointments')
      return res.json() as Promise<{ appointments: Appointment[] }>
    }
  })

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateAppointmentRequest) => {
      const res = await fetch(`/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details ? `${error.error}\n${error.details}` : error.error || 'Failed to create appointment'
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment added!')
      // Clear only plate number for quick re-entry
      setFormData(prev => ({ ...prev, plateNumber: '' }))
      // Auto-focus plate number input for next entry
      setTimeout(() => plateInputRef.current?.focus(), 100)
    },
    onError: (error: Error) => {
      toast.error(error.message, { duration: 5000 })
    }
  })

  // Delete appointment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to delete appointment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment deleted (no show)')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    if (!formData.technician || !formData.plateNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    createMutation.mutate({
      assignedTechnician: formData.technician,
      plateNumber: formData.plateNumber,
      timeRange: {
        start: formData.startTime,
        end: endTime
      },
      date: selectedDate
    })
  }

  const handleDelete = (id: string) => {
    setAppointmentToDelete(id)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (appointmentToDelete) {
      deleteMutation.mutate(appointmentToDelete)
    }
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  const handleCreateJobOrder = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setShowCreateJobOrderModal(true)
  }

  const handleCreateJobOrderSuccess = () => {
    setShowCreateJobOrderModal(false)
    setSelectedAppointment(null)
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    toast.success('Job order created from appointment!')
  }

  const handleTimeSlotSelect = (startTime: string) => {
    // Just set the start time, duration is already set
    setFormData(prev => ({
      ...prev,
      startTime
    }))
  }

  const technicians = techniciansData?.users || []
  const appointments = appointmentsData?.appointments || []

  // Auto-focus plate input on mount
  useEffect(() => {
    plateInputRef.current?.focus()
  }, [])

  return (
    <div className="flex-1 overflow-auto p-6">
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Appointments</h1>
        <p className="text-neutral-600">Record appointments and convert them to job orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Entry Form */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Entry</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Work Duration *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={150}>2.5 hours</option>
                <option value={180}>3 hours</option>
                <option value={210}>3.5 hours</option>
                <option value={240}>4 hours</option>
                <option value={270}>4.5 hours</option>
                <option value={300}>5 hours</option>
                <option value={330}>5.5 hours</option>
                <option value={360}>6 hours</option>
                <option value={420}>7 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Technician *
              </label>
              <select
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select technician...</option>
                {technicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name} ({tech.level})
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Schedule Selector */}
            {formData.technician && (
              <div className="border-t border-neutral-200 pt-4">
                <TechnicianScheduleView
                  technicianId={formData.technician}
                  date={selectedDate}
                  duration={formData.duration}
                  onTimeSlotSelect={handleTimeSlotSelect}
                  selectedStart={formData.startTime}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Time {formData.technician && <span className="text-xs text-neutral-500">(or select from schedule above)</span>}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-neutral-500 mt-1">
                End time: {endTime}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Plate Number *
              </label>
              <input
                ref={plateInputRef}
                type="text"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                placeholder="ABC1234"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                required
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-[color:var(--color-ford-blue)] hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Appointment'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Workflow:</strong> 1) Select work duration, 2) Select technician to see their schedule, 
              3) Click an available time slot to set start time, 4) Enter plate number, 5) Click "Add Appointment". 
              The form stays open for quick successive entries!
            </p>
          </div>
        </div>

        {/* Appointments List */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Appointments for {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-neutral-500">Loading...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No appointments scheduled for this date
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {appointments.map((appointment) => (
                <div
                  key={appointment._id}
                  className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {appointment.plateNumber}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {appointment.assignedTechnician.name}
                        {appointment.assignedTechnician.level && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {appointment.assignedTechnician.level}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-neutral-600">
                      {appointment.timeRange.start} - {appointment.timeRange.end}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleCreateJobOrder(appointment)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors"
                    >
                      Create Job Order
                    </button>
                    <button
                      onClick={() => handleDelete(appointment._id)}
                      disabled={deleteMutation.isPending}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors disabled:opacity-50"
                    >
                      ✕ No Show
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Job Order from Appointment Modal */}
      {showCreateJobOrderModal && selectedAppointment && (
        <CreateJobOrderFromAppointmentModal
          appointment={selectedAppointment}
          onClose={() => {
            setShowCreateJobOrderModal(false)
            setSelectedAppointment(null)
          }}
          onSuccess={handleCreateJobOrderSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Appointment"
        message="Mark this appointment as no-show and delete it? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  )
}

