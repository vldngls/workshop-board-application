import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Read the manifest file from the public directory
    const manifestPath = join(process.cwd(), 'public', 'site.webmanifest')
    const manifestContent = readFileSync(manifestPath, 'utf8')
    
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
