import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Read the manifest file from the public directory
    // Try multiple possible paths to handle different deployment scenarios
    const possiblePaths = [
      join(process.cwd(), 'public', 'site.webmanifest'),
      join(process.cwd(), 'web', 'public', 'site.webmanifest'),
      join(__dirname, '..', '..', '..', '..', 'public', 'site.webmanifest'),
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
    
    if (!manifestContent) {
      return new NextResponse('Manifest not found', { status: 404 })
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
    return new NextResponse('Manifest not found', { status: 404 })
  }
}
