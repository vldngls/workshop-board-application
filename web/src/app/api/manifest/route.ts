import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Read the manifest file from the public directory
    // Vercel-friendly path resolution
    const possiblePaths = [
      join(process.cwd(), 'public', 'site.webmanifest'),
      join(process.cwd(), 'web', 'public', 'site.webmanifest'),
      // For Vercel: public files are at root of web directory
      join(process.cwd(), 'public', 'site.webmanifest'),
    ]
    
    let manifestContent: string | null = null
    for (const manifestPath of possiblePaths) {
      try {
        manifestContent = readFileSync(manifestPath, 'utf8')
        break
      } catch {
        // Try next path
        continue
      }
    }
    
    // Fallback: Return a basic manifest if file can't be read (serverless compatibility)
    if (!manifestContent) {
      const fallbackManifest = {
        name: "Job Control Board",
        short_name: "Job Board",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ],
        theme_color: "#003478",
        background_color: "#ffffff",
        display: "standalone"
      }
      
      return NextResponse.json(fallbackManifest, {
        headers: {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    return new NextResponse(manifestContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving manifest:', error)
    // Return fallback manifest instead of 404
    const fallbackManifest = {
      name: "Job Control Board",
      short_name: "Job Board",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ],
      theme_color: "#003478",
      background_color: "#ffffff",
      display: "standalone"
    }
    
    return NextResponse.json(fallbackManifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
}
