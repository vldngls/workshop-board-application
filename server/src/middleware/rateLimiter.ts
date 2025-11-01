/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

class MemoryRateLimitStore {
  private store: RateLimitStore = {}
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      Object.keys(this.store).forEach(key => {
        if (this.store[key].resetTime < now) {
          delete this.store[key]
        }
      })
    }, 5 * 60 * 1000)
  }

  get(key: string): { count: number; resetTime: number } | null {
    const entry = this.store[key]
    if (!entry) return null
    
    // Clean up if expired
    if (entry.resetTime < Date.now()) {
      delete this.store[key]
      return null
    }
    
    return entry
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now()
    const entry = this.store[key]
    
    if (!entry || entry.resetTime < now) {
      // Create new window
      this.store[key] = {
        count: 1,
        resetTime: now + windowMs
      }
      return this.store[key]
    }
    
    // Increment existing window
    entry.count++
    return entry
  }

  reset(key: string): void {
    delete this.store[key]
  }
}

const store = new MemoryRateLimitStore()

interface RateLimitOptions {
  windowMs?: number      // Time window in milliseconds (default: 15 minutes)
  maxRequests?: number   // Maximum requests per window (default: 100)
  skipSuccessfulRequests?: boolean  // Don't count successful requests
  skipFailedRequests?: boolean      // Don't count failed requests
  keyGenerator?: (req: any) => string  // Custom key generator
  onLimitReached?: (req: any, res: any) => void  // Custom handler
  skipPaths?: string[]   // Paths to skip rate limiting
}

function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => {
      // Default: use IP address + user ID (if authenticated)
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                 req.socket?.remoteAddress || 
                 'unknown'
      const userId = req.user?.sub || 'anonymous'
      return `${ip}:${userId}`
    },
    onLimitReached = (req, res) => {
      res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    },
    skipPaths = []
  } = options

  return (req: any, res: any, next: any) => {
    // Skip rate limiting for auth verification endpoints (these are called frequently)
    // Also skip for health checks and public endpoints
    const defaultSkipPaths = [
      '/health',               // Health checks
      '/maintenance/settings/public'  // Public maintenance endpoint
    ]
    
    const allSkipPaths = [...defaultSkipPaths, ...skipPaths]
    
    if (allSkipPaths.some(path => req.path === path || req.path.startsWith(path))) {
      return next()
    }

    const key = keyGenerator(req)
    const entry = store.get(key)

    if (!entry) {
      // First request in window
      store.increment(key, windowMs)
      return next()
    }

    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      // Log rate limit violation
      const logger = require('../utils/logger')
      logger.warn('Rate limit exceeded', {
        ip: req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket?.remoteAddress,
        userId: req.user?.sub,
        path: req.path,
        method: req.method,
        count: entry.count
      })
      
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - Date.now()) / 1000))
      return onLimitReached(req, res)
    }

    // Increment and continue
    store.increment(key, windowMs)
    
    // Track response status if needed
    const originalSend = res.send
    res.send = function(body: any) {
      const statusCode = res.statusCode
      const shouldSkip = 
        (skipSuccessfulRequests && statusCode < 400) ||
        (skipFailedRequests && statusCode >= 400)
      
      if (!shouldSkip) {
        store.increment(key, windowMs)
      }
      
      return originalSend.call(this, body)
    }
    
    next()
  }
}

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // Only 5 login attempts per 15 minutes
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
               req.socket?.remoteAddress || 
               'unknown'
    return `auth:${ip}`
  }
})

// Very lenient rate limiter for auth verification endpoints
// These are called frequently by React components on page load
export const authVerificationRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100, // Allow 100 verification requests per minute
  skipPaths: ['/auth/login'] // Login has separate limiter
})

// Standard rate limiter for API endpoints
// Note: Auth verification endpoints (/api/auth/me, /api/users/me) should NOT use this
// as they are called frequently by multiple components on page load
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200 // Increased to 200 to accommodate normal usage
})

// Stricter rate limiter for job order modifications
export const jobOrderModificationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50 // 50 modifications per hour per user
})

module.exports = {
  createRateLimiter,
  authRateLimiter,
  authVerificationRateLimiter,
  apiRateLimiter,
  jobOrderModificationRateLimiter
}
    