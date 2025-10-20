interface SkeletonLoaderProps {
  type?: 'text' | 'button' | 'card' | 'avatar' | 'custom'
  lines?: number
  className?: string
  width?: string
  height?: string
}

export default function SkeletonLoader({ 
  type = 'text', 
  lines = 1, 
  className = '', 
  width, 
  height 
}: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, index) => (
              <div
                key={index}
                className={`loading-skeleton-text ${className}`}
                style={{ 
                  width: width || (index === lines - 1 ? '75%' : '100%'),
                  height: height || '1rem'
                }}
              />
            ))}
          </div>
        )
      
      case 'button':
        return (
          <div 
            className={`loading-skeleton-button ${className}`}
            style={{ width, height }}
          />
        )
      
      case 'card':
        return (
          <div 
            className={`loading-skeleton-card ${className}`}
            style={{ width, height }}
          />
        )
      
      case 'avatar':
        return (
          <div 
            className={`loading-skeleton rounded-full ${className}`}
            style={{ 
              width: width || '2.5rem', 
              height: height || '2.5rem' 
            }}
          />
        )
      
      case 'custom':
        return (
          <div 
            className={`loading-skeleton ${className}`}
            style={{ width, height }}
          />
        )
      
      default:
        return null
    }
  }

  return renderSkeleton()
}
