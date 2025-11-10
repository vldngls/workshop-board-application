import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import BugReportButton from "@/components/BugReportButton";
import MaintenanceNotice from "@/components/MaintenanceNotice";
import { getSession } from "@/server/auth/session";
import { getMaintenanceStatus } from "@/server/maintenance";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Control Board - Workshop Management System",
  description: "Professional workshop management system for job orders, appointments, and technician scheduling",
  keywords: "workshop, job orders, appointments, technician, management, ford",
  authors: [{ name: "Job Control Board Team" }],
  robots: "noindex, nofollow", // Internal system
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const headerPath =
    headerStore.get("x-route-path") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path") ??
    headerStore.get("x-next-router-pathname") ??
    headerStore.get("next-url") ??
    headerStore.get("referer") ??
    "";

  const rawPath =
    headerPath ||
    "";
  const normalizedPath = (() => {
    try {
      const path = new URL(rawPath, "http://localhost").pathname;
      return path.replace(/\/\([^/]+\)/g, "");
    } catch {
      if (rawPath.startsWith("/")) {
        return rawPath.replace(/\/\([^/]+\)/g, "");
      }
      return "/";
    }
  })();
  const [maintenance, session] = await Promise.all([
    getMaintenanceStatus(),
    getSession(),
  ]);

  const isSuperAdmin = session?.role === "superadmin";
  const allowMaintenanceBypass = normalizedPath.startsWith("/admin-login");
  const showMaintenance =
    maintenance.isUnderMaintenance && !isSuperAdmin && !allowMaintenanceBypass;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-white text-neutral-900`}
      >
        <QueryProvider>
          {showMaintenance ? (
            <MaintenanceNotice message={maintenance.maintenanceMessage} />
          ) : (
            <>
            {children}
            <BugReportButton />
            </>
          )}
        </QueryProvider>
      </body>
    </html>
  );
}
