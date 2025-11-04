import { NextRequest, NextResponse } from "next/server"
import { jwtVerify, JWTPayload as JoseJWTPayload } from 'jose'
import { decryptToken } from '@/utils/tokenCrypto'

type RoleClaim = 'administrator' | 'job-controller' | 'technician' | 'superadmin'

// Cache for maintenance status (5 seconds) to avoid excessive API calls
let maintenanceCache: {
  isUnderMaintenance: boolean
  timestamp: number
} | null = null

const MAINTENANCE_CACHE_TTL = 5000 // 5 seconds

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const encToken = req.cookies.get("token")?.value
  const origin = req.nextUrl.origin
  
  

  // Always allow core public assets
  if (
    pathname.startsWith("/_next") || 
    pathname.startsWith("/api") || 
    pathname === "/favicon.ico" || 
    pathname === "/site.webmanifest" ||
    pathname.startsWith("/android-chrome") ||
    pathname.startsWith("/apple-touch-icon") ||
    pathname === "/file.svg" ||
    pathname === "/globe.svg" ||
    pathname === "/next.svg" ||
    pathname === "/vercel.svg" ||
    pathname === "/window.svg"
  ) {
    return NextResponse.next()
  }

  // Maintenance mode gate: check early with caching
  try {
    // Check cache first
    let isUnderMaintenance = false
    const now = Date.now()
    
    if (maintenanceCache && (now - maintenanceCache.timestamp) < MAINTENANCE_CACHE_TTL) {
      // Use cached value
      isUnderMaintenance = maintenanceCache.isUnderMaintenance
    } else {
      // Cache miss or expired, fetch fresh data
      try {
        // Create timeout controller for fetch (compatible with all Node versions)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        
        const res = await fetch(`${origin}/api/maintenance/settings/public`, { 
          cache: 'no-store',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        if (res.ok) {
          const data = await res.json().catch(() => null)
          isUnderMaintenance = !!data?.isUnderMaintenance
          // Update cache
          maintenanceCache = {
            isUnderMaintenance,
            timestamp: now
          }
        } else {
          // If fetch fails, use cached value if available, otherwise allow access
          if (maintenanceCache) {
            isUnderMaintenance = maintenanceCache.isUnderMaintenance
          }
        }
      } catch (fetchError) {
        // Network error - use cache if available, otherwise allow access
        if (maintenanceCache) {
          isUnderMaintenance = maintenanceCache.isUnderMaintenance
        }
      }
    }

    if (isUnderMaintenance) {
      // If superadmin, allow full access during maintenance
      if (encToken) {
        const jwtSecret = process.env.JWT_SECRET
        if (jwtSecret) {
          try {
            const secret = new TextEncoder().encode(jwtSecret)
            const raw = await decryptToken(encToken)
            const { payload } = await jwtVerify(raw, secret)
            const role = (payload as JoseJWTPayload & { role?: RoleClaim }).role
            if (role === 'superadmin') {
              return NextResponse.next()
            }
          } catch {
            // fall through
          }
        }
      }

      // Strict maintenance gate for everyone else: only allow root ('/') to render maintenance page
      const url = req.nextUrl.clone()
      // Allow root to render maintenance page without redirect loop
      if (pathname === '/') {
        return NextResponse.next()
      }
      // For any other route, show maintenance warning page at root
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  } catch {
    // If status check fails, do not block
  }

  // Allow public auth routes only if not authenticated; authenticated users handled below
  if ((pathname.startsWith("/login") || pathname.startsWith("/admin-login")) && !encToken) {
    return NextResponse.next()
  }

  // Not authenticated
  if (!encToken) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Verify JWT token
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const raw = await decryptToken(encToken)
    const { payload } = await jwtVerify(raw, secret)
    const role = payload.role as string

    // If already authenticated, keep users away from auth pages
    if (pathname === '/login' || pathname === '/admin-login') {
      const url = req.nextUrl.clone()
      url.pathname = role === 'superadmin' ? '/dashboard/maintenance' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // RBAC enforcement
    if (pathname.startsWith("/admin")) {
      if (role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    } else if (pathname.startsWith("/job-controller")) {
      if (role !== "job-controller" && role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    } else if (pathname.startsWith("/technician")) {
      if (role !== "technician" && role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    } else if (pathname.startsWith("/dashboard/maintenance")) {
      if (role !== "superadmin") {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    } else if (pathname.startsWith("/dashboard/account-management")) {
      if (role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    } else if (pathname.startsWith("/dashboard")) {
      // Dashboard is accessible to all authenticated users
      // Individual pages will handle role-based access
      return NextResponse.next()
    }

    return NextResponse.next()
  } catch (err) {
    // Invalid or expired token
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
}

export const config = {
  // Run on all routes; logic above skips assets and API as needed
  matcher: ["/(.*)"],
}


