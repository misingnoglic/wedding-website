import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/auth'

// Non-admins get an empty object so the response doesn't advertise the admin flag
export async function GET() {
  const body = (await isAdminSession()) ? { isAdmin: true } : {}
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
}
