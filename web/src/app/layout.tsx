import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";

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
  viewport: "width=device-width, initial-scale=1",
  robots: "noindex, nofollow", // Internal system
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-white text-neutral-900`}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
