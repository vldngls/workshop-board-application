import type { BreakTime } from '@/types/auth'

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Check if a time range overlaps with any break times
 */
export function hasBreakTimeOverlap(
  startTime: string,
  endTime: string,
  breakTimes: BreakTime[]
): boolean {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  return breakTimes.some(breakTime => {
    const breakStartMinutes = timeToMinutes(breakTime.startTime)
    const breakEndMinutes = timeToMinutes(breakTime.endTime)

    // Check for overlap
    return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes
  })
}

/**
 * Get all break times that overlap with a given time range
 */
export function getOverlappingBreakTimes(
  startTime: string,
  endTime: string,
  breakTimes: BreakTime[]
): BreakTime[] {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  return breakTimes.filter(breakTime => {
    const breakStartMinutes = timeToMinutes(breakTime.startTime)
    const breakEndMinutes = timeToMinutes(breakTime.endTime)

    // Check for overlap
    return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes
  })
}

/**
 * Calculate total break time duration in minutes for a given time range
 */
export function calculateBreakTimeDuration(
  startTime: string,
  endTime: string,
  breakTimes: BreakTime[]
): number {
  const overlappingBreaks = getOverlappingBreakTimes(startTime, endTime, breakTimes)
  
  return overlappingBreaks.reduce((total, breakTime) => {
    const breakStartMinutes = timeToMinutes(breakTime.startTime)
    const breakEndMinutes = timeToMinutes(breakTime.endTime)
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)

    // Calculate the actual overlap duration
    const overlapStart = Math.max(startMinutes, breakStartMinutes)
    const overlapEnd = Math.min(endMinutes, breakEndMinutes)
    
    return total + Math.max(0, overlapEnd - overlapStart)
  }, 0)
}

/**
 * Get available time slots by excluding break times
 */
export function getAvailableTimeSlots(
  startTime: string,
  endTime: string,
  breakTimes: BreakTime[]
): Array<{ start: string; end: string }> {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  
  // Sort break times by start time
  const sortedBreaks = [...breakTimes].sort((a, b) => 
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  const availableSlots: Array<{ start: string; end: string }> = []
  let currentStart = startMinutes

  for (const breakTime of sortedBreaks) {
    const breakStartMinutes = timeToMinutes(breakTime.startTime)
    const breakEndMinutes = timeToMinutes(breakTime.endTime)

    // If break is within our time range
    if (breakStartMinutes < endMinutes && breakEndMinutes > startMinutes) {
      // Add available slot before break (if any)
      if (currentStart < breakStartMinutes) {
        availableSlots.push({
          start: minutesToTime(currentStart),
          end: minutesToTime(breakStartMinutes)
        })
      }
      
      // Move current start to after the break
      currentStart = Math.max(currentStart, breakEndMinutes)
    }
  }

  // Add final available slot (if any)
  if (currentStart < endMinutes) {
    availableSlots.push({
      start: minutesToTime(currentStart),
      end: minutesToTime(endMinutes)
    })
  }

  return availableSlots
}

/**
 * Validate break time configuration
 */
export function validateBreakTimes(breakTimes: BreakTime[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (let i = 0; i < breakTimes.length; i++) {
    const breakTime = breakTimes[i]
    
    // Check required fields
    if (!breakTime.description.trim()) {
      errors.push(`Break time ${i + 1}: Description is required`)
    }
    
    // Check time format
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(breakTime.startTime)) {
      errors.push(`Break time ${i + 1}: Invalid start time format`)
    }
    
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(breakTime.endTime)) {
      errors.push(`Break time ${i + 1}: Invalid end time format`)
    }
    
    // Check time logic
    const startMinutes = timeToMinutes(breakTime.startTime)
    const endMinutes = timeToMinutes(breakTime.endTime)
    
    if (startMinutes >= endMinutes) {
      errors.push(`Break time ${i + 1}: End time must be after start time`)
    }
    
    // Check for overlapping break times
    for (let j = i + 1; j < breakTimes.length; j++) {
      const otherBreak = breakTimes[j]
      const otherStartMinutes = timeToMinutes(otherBreak.startTime)
      const otherEndMinutes = timeToMinutes(otherBreak.endTime)
      
      if (startMinutes < otherEndMinutes && endMinutes > otherStartMinutes) {
        errors.push(`Break times ${i + 1} and ${j + 1} overlap`)
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}
