import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from 'jose'

interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get("token")?.value
  const origin = req.nextUrl.origin

  // Always allow core public assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  // Maintenance mode gate: check early
  try {
    const res = await fetch(`${origin}/api/maintenance/status`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const isUnderMaintenance = !!data?.isUnderMaintenance

      if (isUnderMaintenance) {
        // Allow dedicated admin login page during maintenance
        if (pathname.startsWith('/admin-login')) {
          return NextResponse.next()
        }

        // If superadmin, allow access everywhere
        if (token) {
          const jwtSecret = process.env.JWT_SECRET
          if (jwtSecret) {
            try {
              const secret = new TextEncoder().encode(jwtSecret)
              const { payload } = await jwtVerify(token, secret)
              const role = (payload as any).role as string
              if (role === 'superadmin') {
                return NextResponse.next()
              }
            } catch {
              // fall through to redirect
            }
          }
        }

        // Redirect all non-admin routes to maintenance or admin-login appropriately
        const url = req.nextUrl.clone()
        if (pathname.startsWith('/login')) {
          url.pathname = '/admin-login'
          return NextResponse.redirect(url)
        }
        // Allow root to render maintenance page without redirect loop
        if (pathname === '/') {
          return NextResponse.next()
        }
        // For any other route, show maintenance warning page at root
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  } catch {
    // If status check fails, do not block
  }

  // Allow public login routes when not in maintenance
  if (pathname.startsWith("/login") || pathname.startsWith("/admin-login")) {
    return NextResponse.next()
  }

  // Not authenticated
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Verify JWT token
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured in middleware')
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role as string

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


