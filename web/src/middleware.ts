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

  // Allow public paths
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
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
  matcher: ["/(admin/:path*)", "/(job-controller/:path*)", "/(technician/:path*)", "/dashboard/:path*"],
}


