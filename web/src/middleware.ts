import { NextRequest, NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const role = req.cookies.get("role")?.value

  // Allow public paths
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  // Not authenticated
  if (!role) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // RBAC enforcement
  if (pathname.startsWith("/admin")) {
    if (role !== "administrator") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  } else if (pathname.startsWith("/job-controller")) {
    if (role !== "job-controller" && role !== "administrator") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  } else if (pathname.startsWith("/technician")) {
    if (role !== "technician" && role !== "administrator") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/(admin/:path*)", "/(job-controller/:path*)", "/(technician/:path*)", "/", "/login"],
}


