'use client'

import React, { useState, useEffect } from 'react'
import type { BreakTime, User } from '@/types/auth'
import { validateBreakTimes } from '@/utils/breakTimeUtils'

interface BreakTimeManagerProps {
  technician: User
  onUpdate: (breakTimes: BreakTime[]) => void
  onClose: () => void
}

export default function BreakTimeManager({ technician, onUpdate, onClose }: BreakTimeManagerProps) {
  const [breakTimes, setBreakTimes] = useState<BreakTime[]>(technician.breakTimes || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Update breakTimes when technician prop changes
  useEffect(() => {
    setBreakTimes(technician.breakTimes || [])
  }, [technician])

  const addBreakTime = () => {
    setBreakTimes([...breakTimes, { description: '', startTime: '12:00', endTime: '13:00' }])
  }

  const removeBreakTime = (index: number) => {
    setBreakTimes(breakTimes.filter((_, i) => i !== index))
  }

  const updateBreakTime = (index: number, field: keyof BreakTime, value: string) => {
    const updated = [...breakTimes]
    updated[index] = { ...updated[index], [field]: value }
    setBreakTimes(updated)
  }

  const validateBreakTimesLocal = (): boolean => {
    const validation = validateBreakTimes(breakTimes)
    if (!validation.valid) {
      setError(validation.errors[0]) // Show first error
      return false
    }
    return true
  }

  const handleSave = async () => {
    setError('')
    
    if (!validateBreakTimesLocal()) {
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch(`/api/users/${technician._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ breakTimes })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Save failed:', errorData)
        throw new Error(errorData.error || 'Failed to update break times')
      }
      
      const result = await response.json()
      
      onUpdate(breakTimes)
      onClose()
    } catch (err) {
      console.error('Save error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="floating-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Break Time Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure break times for {technician.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-red-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {breakTimes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg mb-2">No break times configured</p>
                <p className="text-sm">Add break times to customize this technician's schedule</p>
              </div>
            ) : (
              breakTimes.map((breakTime, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-900">Break Time {index + 1}</h3>
                    {breakTimes.length > 1 && (
                      <button
                        onClick={() => removeBreakTime(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        value={breakTime.description}
                        onChange={(e) => updateBreakTime(index, 'description', e.target.value)}
                        placeholder="e.g., Lunch Break, Coffee Break"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        value={breakTime.startTime}
                        onChange={(e) => updateBreakTime(index, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time *
                      </label>
                      <input
                        type="time"
                        value={breakTime.endTime}
                        onChange={(e) => updateBreakTime(index, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            <button
              onClick={addBreakTime}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium"
            >
              + Add Break Time
            </button>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700 transition-all duration-200 border border-gray-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Break Times'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
