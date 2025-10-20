import type { NextConfig } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  typedRoutes: false,
  // Use default turbopack settings on Vercel; avoid custom root that causes warnings
  // Allow network access only in development
  ...(process.env.NODE_ENV !== 'production' && {
    allowedDevOrigins: [
      'localhost',
      '127.0.0.1',
      // Note: RegExp patterns not supported in allowedDevOrigins
      // Network access is handled at the server level instead
    ],
  }),
  // Removed rewrite rule that was bypassing Next.js API routes
  // async rewrites() {
  //   return [
  //     {
  //       source: "/api/:path*",
  //       destination: `${API_BASE}/api/:path*`,
  //     },
  //   ];
  // },
};

export default nextConfig;
