import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { decryptToken } from "@/utils/tokenCrypto";

type RoleClaim =
  | "administrator"
  | "job-controller"
  | "technician"
  | "superadmin"
  | "service-advisor";

const PUBLIC_AUTH_PATHS = ["/login", "/admin-login"];

function normalizePath(path: string) {
  return path.replace(/\/\([^/]+\)/g, "");
}

function isPublicAsset(path: string) {
  return (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path === "/favicon.ico" ||
    path === "/site.webmanifest" ||
    path.startsWith("/android-chrome") ||
    path.startsWith("/apple-touch-icon") ||
    path === "/file.svg" ||
    path === "/globe.svg" ||
    path === "/next.svg" ||
    path === "/vercel.svg" ||
    path === "/window.svg"
  );
}

function defaultRouteForRole(role: RoleClaim | string | undefined) {
  switch (role) {
    case "superadmin":
      return "/dashboard/maintenance";
    case "administrator":
    case "service-advisor":
      return "/dashboard";
    case "technician":
      return "/dashboard/technician";
    case "job-controller":
    default:
      return "/dashboard/workshop";
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedPath = normalizePath(pathname);

  const makeNextResponse = () => {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-route-path", normalizedPath);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };

  if (isPublicAsset(pathname)) {
    return makeNextResponse();
  }

  const encToken = req.cookies.get("token")?.value;

  if (!encToken) {
    if (PUBLIC_AUTH_PATHS.some((path) => normalizedPath.startsWith(path))) {
      return makeNextResponse();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("[middleware] JWT_SECRET missing");
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

          try {
    const secret = new TextEncoder().encode(jwtSecret);
    const raw = await decryptToken(encToken);
    const { payload } = await jwtVerify(raw, secret);
    const role = payload.role as RoleClaim | undefined;

    if (PUBLIC_AUTH_PATHS.some((path) => normalizedPath.startsWith(path))) {
      const url = req.nextUrl.clone();
      url.pathname = defaultRouteForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (normalizedPath.startsWith("/dashboard/maintenance") && role !== "superadmin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (normalizedPath.startsWith("/dashboard/account-management")) {
      if (role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
    }
    }

    if (normalizedPath.startsWith("/admin")) {
      if (role !== "administrator" && role !== "superadmin") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    if (normalizedPath.startsWith("/job-controller")) {
      if (
        role !== "job-controller" &&
        role !== "administrator" &&
        role !== "superadmin"
      ) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    if (normalizedPath.startsWith("/technician")) {
      if (
        role !== "technician" &&
        role !== "administrator" &&
        role !== "superadmin"
      ) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    return makeNextResponse();
  } catch (error) {
    console.warn("[middleware] Session verification failed:", error);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.cookies.delete("token");
    response.cookies.delete("refreshToken");
    return response;
  }
}

export const config = {
  matcher: ["/(.*)"],
};

