import { useRef, useCallback, useEffect } from 'react'

interface UseDragScrollReturn {
  containerRef: React.RefObject<HTMLDivElement>
  handleMouseDown: (e: React.MouseEvent) => void
}

export const useDragScroll = (): UseDragScrollReturn => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const velocity = useRef(0)
  const lastX = useRef(0)
  const lastTime = useRef(0)
  const animationFrame = useRef<number | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    // Only start dragging if clicking on the container itself, not on child elements
    if (e.target === containerRef.current || (e.target as Element).closest('.drag-scroll-container')) {
      isDragging.current = true
      startX.current = e.pageX - containerRef.current.offsetLeft
      scrollLeft.current = containerRef.current.scrollLeft
      lastX.current = e.pageX
      lastTime.current = Date.now()
      velocity.current = 0
      
      // Cancel any ongoing animation
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
      
      // Prevent text selection while dragging
      e.preventDefault()
      
      // Add cursor style
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    
    e.preventDefault()
    const currentTime = Date.now()
    const deltaTime = currentTime - lastTime.current
    const deltaX = e.pageX - lastX.current
    
    // Calculate velocity for inertia
    if (deltaTime > 0) {
      velocity.current = deltaX / deltaTime
    }
    
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startX.current) * 2 // Multiply for faster scrolling
    containerRef.current.scrollLeft = scrollLeft.current - walk
    
    lastX.current = e.pageX
    lastTime.current = currentTime
  }, [])

  const animateInertia = useCallback(() => {
    if (!containerRef.current || Math.abs(velocity.current) < 0.1) {
      velocity.current = 0
      animationFrame.current = null
      return
    }
    
    // Apply velocity with friction
    containerRef.current.scrollLeft -= velocity.current * 16 // 16ms frame time
    velocity.current *= 0.85 // Increased friction factor for quicker stop
    
    animationFrame.current = requestAnimationFrame(animateInertia)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    
    // Start inertia animation if there's velocity
    if (Math.abs(velocity.current) > 0.1) {
      animationFrame.current = requestAnimationFrame(animateInertia)
    }
  }, [animateInertia])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    
    // Start inertia animation if there's velocity
    if (Math.abs(velocity.current) > 0.1) {
      animationFrame.current = requestAnimationFrame(animateInertia)
    }
  }, [animateInertia])

  // Add event listeners
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('mouseleave', handleMouseLeave)
      
      // Clean up animation frame
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
    }
  }, [handleMouseMove, handleMouseUp, handleMouseLeave])

  return {
    containerRef,
    handleMouseDown
  }
}
